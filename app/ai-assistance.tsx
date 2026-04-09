import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  Alert,
  Animated,
  Easing
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDocs, collection, query, where } from 'firebase/firestore'
import { db } from '../lib/firebaseConfig'
import { useColorScheme } from 'nativewind'

const Gemini = require('./Gemini Model/Gemini-Model')

const GREETING_PROMPT_TEMPLATE = `Please greet {name} and provide a brief overview of what data we have available for them to interact with. Be warm and professional, mentioning key insights or helpful resources they can explore. Talk mixed in Cebuano and English (Bislish) and then use easy words`

const INSTRUCTION_SUFFIX = `IMPORTANT: Keep responses concise and brief (1-3 sentences), use easy words unless the user asks for detailed explanation or complex analysis. Be direct and helpful. Talk mixed in Cebuano and English (Bislish) and then use easy words.`

let systemInstruction = ``

type AIAssistanceProps = {
  userId?: string
  userRole?: string
  memberName?: string
  userEmail?: string
  colorScheme?: 'light' | 'dark'
}

function encodeLatex(latex: string) {
  try {
    return encodeURIComponent(latex)
  } catch (e) {
    return latex
  }
}

function parseInlineNodes(rawText: string, isDarkMode: boolean = false) {
  if (!rawText) return []

  const nodes: any[] = []
  const blocks: { latex: string; block: boolean }[] = []
  const blockRegex = /\$\$([\s\S]+?)\$\$/g

  rawText = rawText.replace(blockRegex, function (_, g1) {
    const token = '___LATEX_BLOCK_' + blocks.length + '___'
    blocks.push({ latex: g1, block: true })
    return token
  })

  const inlineBlocks: { latex: string; block: boolean }[] = []
  const inlineRegex = /\$([^\$]+?)\$/g

  rawText = rawText.replace(inlineRegex, function (_, g1) {
    const token = '___LATEX_INLINE_' + inlineBlocks.length + '___'
    inlineBlocks.push({ latex: g1, block: false })
    return token
  })

  const tokenPatternParts = ['\\*\\*(.+?)\\*\\*', '\\*(.+?)\\*', '`([^`]+?)`']

  const latexTokenRegexParts: string[] = []
  blocks.forEach(function (_, i) {
    latexTokenRegexParts.push('___LATEX_BLOCK_' + i + '___')
  })
  inlineBlocks.forEach(function (_, i) {
    latexTokenRegexParts.push('___LATEX_INLINE_' + i + '___')
  })

  const combinedPattern = tokenPatternParts
    .concat(
      latexTokenRegexParts.map(function (s) {
        return s.replace(/_/g, '\\_')
      })
    )
    .join('|')

  const combinedRe = new RegExp(combinedPattern, 'g')
  let lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = combinedRe.exec(rawText)) !== null) {
    if (match.index > lastIndex) {
      nodes.push({ type: 'text', text: rawText.slice(lastIndex, match.index) })
    }

    if (match[1]) {
      nodes.push({ type: 'bold', text: match[1] })
    } else if (match[2]) {
      nodes.push({ type: 'italic', text: match[2] })
    } else if (match[3]) {
      nodes.push({ type: 'code', text: match[3] })
    } else {
      const token = match[0]
      const blockIndex = blocks.findIndex(function (_, i) {
        return token === '___LATEX_BLOCK_' + i + '___'
      })

      if (blockIndex !== -1) {
        nodes.push({ type: 'latex', text: blocks[blockIndex].latex, block: true })
      } else {
        const inlineIndex = inlineBlocks.findIndex(function (_, i) {
          return token === '___LATEX_INLINE_' + i + '___'
        })

        if (inlineIndex !== -1) {
          nodes.push({ type: 'latex', text: inlineBlocks[inlineIndex].latex, block: false })
        } else {
          nodes.push({ type: 'text', text: token })
        }
      }
    }

    lastIndex = combinedRe.lastIndex
  }

  if (lastIndex < rawText.length) {
    nodes.push({ type: 'text', text: rawText.slice(lastIndex) })
  }

  let keyIdx = 0

  return nodes.map(function (n) {
    const key = 'i' + keyIdx++

    if (n.type === 'text') return React.createElement(Text, { key }, n.text)
    if (n.type === 'bold') return React.createElement(Text, { key, className: `font-bold text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}` }, n.text)
    if (n.type === 'italic') return React.createElement(Text, { key, className: `italic text-base ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}` }, n.text)
    if (n.type === 'code') return React.createElement(Text, { key, className: `font-mono text-base px-1.5 py-0.5 rounded bg-opacity-10 ${isDarkMode ? 'bg-white text-gray-300' : 'bg-black text-gray-900'}` }, n.text)
    if (n.type === 'latex') {
      const encoded = encodeLatex(n.text)
      const latexClass = n.block 
        ? `font-mono text-base p-2 rounded my-1.5 ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-red-0 text-gray-900'}`
        : `font-mono text-base px-1.5 py-0.5 rounded ${isDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-red-0 text-gray-900'}`
      return React.createElement(
        Text,
        {
          key,
          className: latexClass,
          accessibilityLabel: 'latex:' + encoded
        },
        n.block ? '$$' + n.text + '$$' : '$' + n.text + '$'
      )
    }

    return React.createElement(Text, { key }, n.text || '')
  })
}

function renderFormattedText(rawText: string, isDarkMode: boolean = false) {
  if (!rawText || typeof rawText !== 'string') return React.createElement(Text, null, '')

  const lines = rawText.split(/\r?\n/)

  if (lines.length === 1) {
    const single = lines[0]
    const hMatch = single.match(/^\s*(#{1,6})\s+(.*)$/)

    if (hMatch) {
      const level = hMatch[1].length
      const rest = hMatch[2]
      const children = parseInlineNodes(rest, isDarkMode)
      const headerClass = level === 1 ? 'text-2xl font-extrabold' : level === 2 ? 'text-xl font-bold' : 'text-lg font-bold'
      const textColor = isDarkMode ? 'text-gray-100' : 'text-gray-900'
      return React.createElement(View, null, React.createElement(Text, { className: `${headerClass} ${textColor}` }, children))
    }

    const childrenNormal = parseInlineNodes(single, isDarkMode)
    const textColor = isDarkMode ? 'text-gray-200' : 'text-gray-900'
    return React.createElement(Text, { className: `text-base leading-6 ${textColor}` }, childrenNormal)
  }

  let keyLine = 0

  return React.createElement(
    View,
    null,
    lines.map(function (ln) {
      const match = ln.match(/^\s*(#{1,6})\s+(.*)$/)

      if (match) {
        const lvl = match[1].length
        const txt = match[2]
        const childrenH = parseInlineNodes(txt, isDarkMode)
        const headerClass = lvl === 1 ? 'text-2xl font-extrabold' : lvl === 2 ? 'text-xl font-bold' : 'text-lg font-bold'
        const textColor = isDarkMode ? 'text-gray-100' : 'text-gray-900'
        return React.createElement(Text, { key: 'L' + keyLine++, className: `${headerClass} ${textColor} mb-1` }, childrenH)
      }

      const childrenL = parseInlineNodes(ln, isDarkMode)
      const textColor = isDarkMode ? 'text-gray-200' : 'text-gray-900'
      return React.createElement(Text, { key: 'L' + keyLine++, className: `text-base leading-6 ${textColor} mb-1` }, childrenL)
    })
  )
}

function AnimatedMessageBubble(props: { text: string; sender: string; isDarkMode: boolean }) {
  const isUser = props.sender === 'user'
  const anim = useRef(new Animated.Value(0)).current

  useEffect(function () {
    Animated.timing(anim, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start()
  }, [anim])

  const animatedStyle = {
    opacity: anim,
    transform: [
      {
        translateY: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [10, 0]
        })
      },
      {
        scale: anim.interpolate({
          inputRange: [0, 1],
          outputRange: [0.98, 1]
        })
      }
    ]
  }

  const bubbleClass = isUser 
    ? 'max-w-[82%] self-end bg-sky-500 rounded-[18px] rounded-br-[6px] py-3 px-3.5 my-1.5'
    : props.isDarkMode
    ? 'max-w-[82%] self-start bg-gray-900 rounded-[18px] rounded-tl-[6px] border border-gray-700 py-3 px-3.5 my-1.5'
    : 'max-w-[82%] self-start bg-white rounded-[18px] rounded-tl-[6px] border border-gray-200 py-3 px-3.5 my-1.5'

  return React.createElement(
    View,
    { className: bubbleClass },
    React.createElement(
      Animated.View,
      { style: animatedStyle },
      renderFormattedText(props.text, props.isDarkMode)
    )
  )
}

export default function AIAssistance(props: AIAssistanceProps) {
  const [firebaseDataSummary, setFirebaseDataSummary] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [loadingGreeting, setLoadingGreeting] = useState(false)
  const isDarkMode = props.colorScheme === 'dark'

  const messagesEndRef = useRef<ScrollView | null>(null)
  const screenAnim = useRef(new Animated.Value(0)).current
  const headerAnim = useRef(new Animated.Value(0)).current
  const inputAnim = useRef(new Animated.Value(0)).current

  const NAV_BAR_HEIGHT = Platform.OS === 'android' ? 8 : 0
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 80 : 48 + NAV_BAR_HEIGHT

  useEffect(function () {
    Animated.parallel([
      Animated.timing(screenAnim, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(headerAnim, {
        toValue: 1,
        duration: 320,
        delay: 60,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(inputAnim, {
        toValue: 1,
        duration: 320,
        delay: 100,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]).start()
  }, [screenAnim, headerAnim, inputAnim])

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const chatKey = `chat_history_${props.userId}`
        const saved = await AsyncStorage.getItem(chatKey)
        if (saved) {
          setMessages(JSON.parse(saved))
        }
      } catch (error) {
        console.warn('Error loading chat history:', error)
      }
    }
    loadChatHistory()
  }, [props.userId])

  useEffect(() => {
    if (messages.length > 0) {
      const saveChatHistory = async () => {
        try {
          const chatKey = `chat_history_${props.userId}`
          await AsyncStorage.setItem(chatKey, JSON.stringify(messages))
        } catch (error) {
          console.warn('Error saving chat history:', error)
        }
      }
      saveChatHistory()
    }
  }, [messages, props.userId])

  useEffect(() => {
    return () => {
      const saveChatHistory = async () => {
        try {
          const chatKey = `chat_history_${props.userId}`
          await AsyncStorage.setItem(chatKey, JSON.stringify(messages))
        } catch (error) {
          console.warn('Error saving chat history on unmount:', error)
        }
      }
      saveChatHistory()
    }
  }, [messages, props.userId])

  useEffect(() => {
    const loadFirebaseData = async () => {
      try {
        const userRole = props.userRole || 'member'
        let allData: any = {}

        if (userRole.toLowerCase().includes('admin')) {
          const groupsSnap = await getDocs(collection(db, 'groups'))
          const usersSnap = await getDocs(collection(db, 'users'))
          const tasksSnap = await getDocs(collection(db, 'tasks'))

          allData.groups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          allData.users = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
          allData.tasks = tasksSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        } else {
          const userTasks = await getDocs(query(collection(db, 'tasks'), where('assignedTo', '==', props.userId || '')))
          allData.myTasks = userTasks.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        }

        const jsonData = JSON.stringify(allData, null, 2)
        const accountInfo = `Account Holder: ${props.memberName || 'User'} (${props.userEmail || 'no-email'})\nRole: ${props.userRole || 'member'}\n\n`
        systemInstruction = `${accountInfo}${jsonData}\n\n${INSTRUCTION_SUFFIX}`
        
        setFirebaseDataSummary(jsonData)

        if (messages.length === 0) {
          setLoadingGreeting(true)
          try {
            const greetingPrompt = GREETING_PROMPT_TEMPLATE.replace('{name}', props.memberName || 'the user')
            const aiGreeting = await Gemini.generateReply([], greetingPrompt, systemInstruction)
            setMessages([{ id: '1', text: aiGreeting, sender: 'bot' }])
            setInitialized(true)
          } catch (err) {
            console.warn('Error generating AI greeting:', err)
            setMessages([{ id: '1', text: `Hello ${props.memberName || 'there'}! I'm here to help you manage and organize your volunteer work. What can I assist you with today?`, sender: 'bot' }])
            setInitialized(true)
          } finally {
            setLoadingGreeting(false)
          }
        } else {
          setInitialized(true)
        }
      } catch (error) {
        console.warn('Error loading Firebase data:', error)
        systemInstruction = `Account Holder: ${props.memberName || 'User'} (${props.userEmail || 'no-email'})\nRole: ${props.userRole || 'member'}`
        setFirebaseDataSummary(systemInstruction)
        if (messages.length === 0) {
          setMessages([{ id: '1', text: 'Ready to assist. How can I help?', sender: 'bot' }])
        }
        setInitialized(true)
        setLoadingGreeting(false)
      }
    }

    loadFirebaseData()
  }, [props.userId, props.userRole, props.memberName, props.userEmail])

  useEffect(function () {
    try {
      if (messagesEndRef.current && typeof messagesEndRef.current.scrollToEnd === 'function') {
        messagesEndRef.current.scrollToEnd({ animated: true })
      }
    } catch (err) {}
  }, [messages, loading])

  async function sendMessage() {
    if (!input || !input.trim() || loading) return

    const userMessage = input.trim()
    const newId = Date.now().toString()
    const updatedMessages = messages.concat([{ id: newId, text: userMessage, sender: 'user' }])

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const botText = await Gemini.generateReply(updatedMessages, userMessage, systemInstruction || firebaseDataSummary)
      setMessages(function (currentMessages) {
        return currentMessages.concat([{ id: Date.now().toString() + '-bot', text: botText, sender: 'bot' }])
      })
    } catch (error: any) {
      Alert.alert('Error', error && error.message ? error.message : 'Failed to get a reply.')
    } finally {
      setLoading(false)
      setTimeout(function () {
        try {
          if (messagesEndRef.current && typeof messagesEndRef.current.scrollToEnd === 'function') {
            messagesEndRef.current.scrollToEnd({ animated: true })
          }
        } catch (err) {}
      }, 100)
    }
  }

  function deleteChatHistory() {
    Alert.alert('Delete chat history', 'This will clear the current conversation only.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async function () {
          try {
            const chatKey = `chat_history_${props.userId}`
            await AsyncStorage.removeItem(chatKey)
            if (systemInstruction) {
              const greetingPrompt = GREETING_PROMPT_TEMPLATE.replace('{name}', props.memberName || 'the user')
              const aiGreeting = await Gemini.generateReply([], greetingPrompt, systemInstruction)
              setMessages([{ id: '1', text: aiGreeting, sender: 'bot' }])
            } else {
              setMessages([{ id: '1', text: `Hello ${props.memberName || 'there'}! Ready to help. What do you need?`, sender: 'bot' }])
            }
            Alert.alert('Deleted', 'Chat history was cleared.')
          } catch (error) {
            console.warn('Error deleting chat:', error)
            setMessages([{ id: '1', text: `Hello ${props.memberName || 'there'}! Ready to help. What do you need?`, sender: 'bot' }])
          }
        }
      }
    ])
  }

  const messageNodes = messages.map(function (item) {
    return React.createElement(AnimatedMessageBubble, { key: item.id, text: item.text, sender: item.sender, isDarkMode })
  })

  const sendDisabled = loading || !input || !input.trim()

  const screenStyle = {
    opacity: screenAnim,
    transform: [
      {
        translateY: screenAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0]
        })
      }
    ]
  }

  const headerStyle = {
    opacity: headerAnim,
    transform: [
      {
        translateY: headerAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-10, 0]
        })
      }
    ]
  }

  const inputStyle = {
    opacity: inputAnim,
    transform: [
      {
        translateY: inputAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0]
        })
      }
    ]
  }

  return React.createElement(
    SafeAreaView,
    { className: `flex-1 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}` },
    React.createElement(
      KeyboardAvoidingView,
      {
        className: 'flex-1',
        behavior: Platform.OS === 'ios' ? 'padding' : undefined,
        keyboardVerticalOffset
      },
      React.createElement(
        Animated.View,
        { style: screenStyle as any, className: 'flex-1' },
        React.createElement(
          Animated.View,
          { style: headerStyle as any, className: `px-4 py-3.5 ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-100'} border-b` },
          React.createElement(
            View,
            { className: 'flex-row items-center justify-between gap-3' },
            React.createElement(
              View,
              { className: 'flex-1' },
              React.createElement(Text, { className: `text-3xl font-black ${isDarkMode ? 'text-gray-100' : 'text-gray-900'}` }, 'NewLife AI'),
              React.createElement(Text, { className: `text-sm font-semibold ${isDarkMode ? 'text-gray-400' : 'text-gray-600'} mt-1` }, `Helping ${props.memberName || 'Member'} (${props.userEmail || 'User'})`)
            ),
            React.createElement(
              TouchableOpacity,
              { className: `px-3 py-2.5 rounded-2xl ${isDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-200'} border`, onPress: deleteChatHistory, activeOpacity: 0.85 },
              React.createElement(Text, { className: `text-sm font-bold ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}` }, 'Delete chat')
            )
          )
        ),
        React.createElement(
          View,
          { className: `flex-1 mx-3 mt-3 mb-2.5 rounded-3xl ${isDarkMode ? 'bg-gray-900 border-gray-700' : 'bg-blue-50 border-blue-200'} border overflow-hidden` },
          React.createElement(
            ScrollView,
            {
              className: 'flex-1',
              contentContainerClassName: 'px-3.5 py-4.5',
              ref: messagesEndRef,
              showsVerticalScrollIndicator: false
            },
            messageNodes,
            loadingGreeting && messages.length === 0
              ? React.createElement(
                  View,
                  { className: 'self-start px-3 py-2.5 rounded-2xl my-1.5 bg-blue-100 dark:bg-gray-800' },
                  React.createElement(Text, { className: `text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}` }, 'AI is thinking...')
                )
              : null,
            loading && !loadingGreeting && messages.length > 1
              ? React.createElement(
                  View,
                  { className: 'self-start px-3 py-2.5 rounded-2xl my-1.5 bg-blue-100 dark:bg-gray-800' },
                  React.createElement(Text, { className: `text-base ${isDarkMode ? 'text-gray-400' : 'text-gray-700'}` }, 'AI is thinking...')
                )
              : null
          )
        ),
        React.createElement(
          Animated.View,
          { style: [{ paddingBottom: 10 + NAV_BAR_HEIGHT }, inputStyle as any], className: `px-3 pt-1.5 ${isDarkMode ? 'bg-black' : 'bg-gray-100'}` },
          React.createElement(
            View,
            { className: `flex-row items-center ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-blue-300'} rounded-full border px-2.5 py-2` },
            React.createElement(TextInput, {
              className: `flex-1 min-h-12 px-3 py-2.5 rounded-2xl text-base ${isDarkMode ? 'bg-gray-700 text-gray-100' : 'bg-gray-100 text-gray-900'} mr-2.5`,
              value: input,
              onChangeText: function (t) {
                setInput(t)
              },
              placeholder: loading ? 'Waiting for response...' : 'Ask me anything...',
              placeholderTextColor: isDarkMode ? '#7b8794' : '#d1d5db',
              editable: !loading,
              returnKeyType: 'send',
              blurOnSubmit: false,
              onSubmitEditing: function () {
                if (!sendDisabled) sendMessage()
              },
              multiline: false
            }),
            React.createElement(
              TouchableOpacity,
              {
                className: `py-3 px-4 rounded-full min-w-[74px] items-center justify-center ${sendDisabled ? 'bg-gray-400' : 'bg-green-600'}`,
                onPress: function () {
                  if (!sendDisabled) sendMessage()
                },
                disabled: sendDisabled,
                activeOpacity: 0.85
              },
              loading
                ? React.createElement(ActivityIndicator, { color: '#ffffff' })
                : React.createElement(Text, { className: 'text-white font-bold text-base' }, 'Send')
            )
          )
        )
      )
    )
  )
}