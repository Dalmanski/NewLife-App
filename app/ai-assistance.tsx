import React, { useEffect, useRef, useState } from 'react'
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  SafeAreaView,
  Animated,
  Easing,
  KeyboardAvoidingView,
  StyleSheet,
  useWindowDimensions,
  Modal
} from 'react-native'
import { useColorScheme } from 'nativewind'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { getDocs, collection } from 'firebase/firestore'
import { Ionicons } from '@expo/vector-icons'
import { db } from '../lib/firebaseConfig'

const Gemini = require('./Gemini Model/Gemini-Model')

const GREETING_PROMPT_TEMPLATE = `Please greet {name} and provide a brief overview of what data we have available for them to interact with. Be warm and professional, mentioning key insights or helpful resources they can explore. Use easy words.`

const INSTRUCTION_SUFFIX = `IMPORTANT: Keep responses concise and brief (1-3 sentences), use easy words unless the user asks for detailed explanation or complex analysis. Be direct and helpful. Use easy words.`

const COLLECTION_NAMES = ['groups', 'users', 'tasks', 'events', 'coreGroups', 'ministies']

const QUICK_PROMPTS = ['Unsa akong task?', 'Unsay upcoming event?', 'Unsaon nako pagamit ning apps?']

let systemInstruction = ''

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
  } catch {
    return latex
  }
}

function getErrorMessage(error: any) {
  if (!error) return 'Unknown error'
  if (typeof error === 'string') return error
  if (error.message) return error.message
  try {
    return JSON.stringify(error)
  } catch {
    return 'Unknown error'
  }
}

function getCurrentDateTimeText() {
  try {
    return new Intl.DateTimeFormat('en-PH', {
      timeZone: 'Asia/Manila',
      dateStyle: 'full',
      timeStyle: 'medium'
    }).format(new Date())
  } catch {
    return new Date().toLocaleString()
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

    if (n.type === 'text') return React.createElement(Text, { key, style: [styles.baseText, isDarkMode ? styles.darkText : styles.lightText] }, n.text)
    if (n.type === 'bold') return React.createElement(Text, { key, style: [styles.baseText, styles.boldText, isDarkMode ? styles.darkText : styles.lightText] }, n.text)
    if (n.type === 'italic') return React.createElement(Text, { key, style: [styles.baseText, styles.italicText, isDarkMode ? styles.darkText : styles.lightText] }, n.text)
    if (n.type === 'code') {
      return React.createElement(
        Text,
        {
          key,
          style: [styles.baseText, styles.codeText, isDarkMode ? styles.codeDark : styles.codeLight]
        },
        n.text
      )
    }
    if (n.type === 'latex') {
      const encoded = encodeLatex(n.text)
      const latexStyle = n.block
        ? [styles.baseText, styles.latexBlock, isDarkMode ? styles.codeDark : styles.codeLight]
        : [styles.baseText, styles.latexInline, isDarkMode ? styles.codeDark : styles.codeLight]

      return React.createElement(
        Text,
        {
          key,
          style: latexStyle,
          accessibilityLabel: 'latex:' + encoded
        },
        n.block ? '$$' + n.text + '$$' : '$' + n.text + '$'
      )
    }

    return React.createElement(Text, { key, style: [styles.baseText, isDarkMode ? styles.darkText : styles.lightText] }, n.text || '')
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
      const headerStyle = level === 1 ? styles.h1 : level === 2 ? styles.h2 : styles.h3
      return React.createElement(Text, { style: [headerStyle, isDarkMode ? styles.darkText : styles.lightText] }, children)
    }

    const childrenNormal = parseInlineNodes(single, isDarkMode)
    return React.createElement(Text, { style: [styles.normalText, isDarkMode ? styles.darkText : styles.lightText] }, childrenNormal)
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
        const headerStyle = lvl === 1 ? styles.h1 : lvl === 2 ? styles.h2 : styles.h3
        return React.createElement(Text, { key: 'L' + keyLine++, style: [headerStyle, styles.lineGap, isDarkMode ? styles.darkText : styles.lightText] }, childrenH)
      }

      const childrenL = parseInlineNodes(ln, isDarkMode)
      return React.createElement(Text, { key: 'L' + keyLine++, style: [styles.normalText, styles.lineGap, isDarkMode ? styles.darkText : styles.lightText] }, childrenL)
    })
  )
}

function AnimatedMessageBubble(props: { text: string; sender: string; isDarkMode: boolean; maxWidth: number }) {
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

  const bubbleStyle = isUser
    ? [styles.userBubble, { maxWidth: props.maxWidth }]
    : props.isDarkMode
    ? [styles.botBubble, styles.botBubbleDark, { maxWidth: props.maxWidth }]
    : [styles.botBubble, styles.botBubbleLight, { maxWidth: props.maxWidth }]

  return React.createElement(
    View,
    { style: bubbleStyle },
    React.createElement(
      Animated.View,
      { style: animatedStyle },
      renderFormattedText(props.text, props.isDarkMode)
    )
  )
}

async function fetchCollectionData(collectionName: string) {
  const snap = await getDocs(collection(db, collectionName))
  return snap.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }))
}

export default function AIAssistance(props: AIAssistanceProps) {
  const { width, height } = useWindowDimensions()
  const { colorScheme } = useColorScheme()
  const [firebaseDataSummary, setFirebaseDataSummary] = useState('')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [loadingGreeting, setLoadingGreeting] = useState(false)
  const [deleteModalVisible, setDeleteModalVisible] = useState(false)
  const isDarkMode = colorScheme === 'dark'
  const isLandscape = width > height

  const bubbleMaxWidth = Math.min(width * 0.82, isLandscape ? 560 : 380)
  const messagesEndRef = useRef<ScrollView | null>(null)
  const screenAnim = useRef(new Animated.Value(0)).current
  const headerAnim = useRef(new Animated.Value(0)).current
  const inputAnim = useRef(new Animated.Value(0)).current

  const currentDateTime = getCurrentDateTimeText()

  async function buildAndSetGreeting() {
    if (!systemInstruction) return false
    setLoadingGreeting(true)
    try {
      const greetingPrompt = GREETING_PROMPT_TEMPLATE.replace('{name}', props.memberName || 'the user')
      const aiGreeting = await Gemini.generateReply([], greetingPrompt, systemInstruction)
      setMessages([{ id: '1', text: aiGreeting, sender: 'bot' }])
      return true
    } catch (error) {
      console.log('[AIAssistance] Greeting failed:', error)
      setMessages([{ id: '1', text: `Hi ${props.memberName || 'Member'}. Don't shy to ask me anything...`, sender: 'bot' }])
      return false
    } finally {
      setLoadingGreeting(false)
      setInitialized(true)
    }
  }

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
        console.log('[AIAssistance] Load chat history error:', error)
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
          console.log('[AIAssistance] Save chat history error:', error)
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
          console.log('[AIAssistance] Cleanup save chat history error:', error)
        }
      }
      saveChatHistory()
    }
  }, [messages, props.userId])

  useEffect(() => {
    const loadFirebaseData = async () => {
      try {
        let allData: Record<string, any> = {}

        for (const collectionName of COLLECTION_NAMES) {
          try {
            allData[collectionName] = await fetchCollectionData(collectionName)
          } catch (collectionError) {
            allData[collectionName] = {
              error: getErrorMessage(collectionError)
            }
          }
        }

        const jsonData = JSON.stringify(allData, null, 2)
        const accountInfo = `Account Holder: ${props.memberName || 'User'} (${props.userEmail || 'no-email'})\nRole: ${props.userRole || 'member'}\nCurrent Date and Time (Asia/Manila): ${currentDateTime}\n\n`
        systemInstruction = `${accountInfo}${jsonData}\n\n${INSTRUCTION_SUFFIX}`

        setFirebaseDataSummary(jsonData)

        const savedKey = `chat_history_${props.userId}`
        const saved = await AsyncStorage.getItem(savedKey)

        if (!saved) {
          await buildAndSetGreeting()
        } else {
          setInitialized(true)
        }
      } catch (error) {
        console.log('[AIAssistance] Load Firebase data error:', error)
        systemInstruction = `Account Holder: ${props.memberName || 'User'} (${props.userEmail || 'no-email'})\nRole: ${props.userRole || 'member'}\nCurrent Date and Time (Asia/Manila): ${currentDateTime}`
        setFirebaseDataSummary(systemInstruction)

        const savedKey = `chat_history_${props.userId}`
        const saved = await AsyncStorage.getItem(savedKey)

        if (!saved) {
          await buildAndSetGreeting()
        } else {
          setInitialized(true)
        }
      }
    }

    loadFirebaseData()
  }, [props.userId, props.userRole, props.memberName, props.userEmail])

  useEffect(function () {
    try {
      if (messagesEndRef.current && typeof messagesEndRef.current.scrollToEnd === 'function') {
        messagesEndRef.current.scrollToEnd({ animated: true })
      }
    } catch (error) {
      console.log('[AIAssistance] Scroll error:', error)
    }
  }, [messages, loading, loadingGreeting])

  async function sendMessage(messageOverride?: string) {
    const rawInput = typeof messageOverride === 'string' ? messageOverride : input
    if (!rawInput || !rawInput.trim() || loading) return

    const userMessage = rawInput.trim()
    const newId = Date.now().toString()
    const updatedMessages = messages.concat([{ id: newId, text: userMessage, sender: 'user' }])

    setMessages(updatedMessages)
    setInput('')
    setLoading(true)

    try {
      const promptWithTime = `${userMessage}\n\nCurrent Date and Time (Asia/Manila): ${getCurrentDateTimeText()}`
      const botText = await Gemini.generateReply(updatedMessages, promptWithTime, systemInstruction || firebaseDataSummary)
      setMessages(function (currentMessages) {
        return currentMessages.concat([{ id: Date.now().toString() + '-bot', text: botText, sender: 'bot' }])
      })
    } catch (error: any) {
      console.log('[AIAssistance] Send message error:', error)
      setMessages(function (currentMessages) {
        return currentMessages.concat([
          {
            id: Date.now().toString() + '-bot-error',
            text: 'Failed to get a reply. Please try again.',
            sender: 'bot'
          }
        ])
      })
    } finally {
      setLoading(false)
      setTimeout(function () {
        try {
          if (messagesEndRef.current && typeof messagesEndRef.current.scrollToEnd === 'function') {
            messagesEndRef.current.scrollToEnd({ animated: true })
          }
        } catch (error) {
          console.log('[AIAssistance] Scroll after send error:', error)
        }
      }, 100)
    }
  }

  function openDeleteModal() {
    console.log('[AIAssistance] openDeleteModal pressed')
    setDeleteModalVisible(true)
  }

  function closeDeleteModal() {
    console.log('[AIAssistance] closeDeleteModal pressed')
    setDeleteModalVisible(false)
  }

  async function confirmDeleteChatHistory() {
    console.log('[AIAssistance] confirmDeleteChatHistory pressed')
    try {
      const chatKey = `chat_history_${props.userId}`
      console.log('[AIAssistance] Removing key:', chatKey)
      await AsyncStorage.removeItem(chatKey)
      console.log('[AIAssistance] AsyncStorage removeItem success')
      setMessages([])
      setInput('')
      setLoading(false)
      setLoadingGreeting(false)
      setDeleteModalVisible(false)
      const greetingResult = await buildAndSetGreeting()
      console.log('[AIAssistance] Greeting after delete:', greetingResult)
    } catch (error) {
      console.log('[AIAssistance] Delete error:', error)
      setDeleteModalVisible(false)
      setMessages([{ id: '1', text: `Hi ${props.memberName || 'Member'}. Don't shy to ask me anything...`, sender: 'bot' }])
    }
  }

  const messageNodes = messages.map(function (item) {
    return React.createElement(AnimatedMessageBubble, {
      key: item.id,
      text: item.text,
      sender: item.sender,
      isDarkMode,
      maxWidth: bubbleMaxWidth
    })
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
    View,
    { style: [styles.root, isDarkMode ? styles.rootDark : styles.rootLight] },
    React.createElement(
      Modal,
      {
        visible: deleteModalVisible,
        transparent: true,
        animationType: 'fade',
        onRequestClose: closeDeleteModal
      },
      React.createElement(
        View,
        { style: styles.modalOverlay },
        React.createElement(
          View,
          { style: [styles.modalCard, isDarkMode ? styles.modalCardDark : styles.modalCardLight] },
          React.createElement(Text, { style: [styles.modalTitle, isDarkMode ? styles.modalTextDark : styles.modalTextLight] }, 'Delete chat history?'),
          React.createElement(
            Text,
            { style: [styles.modalMessage, isDarkMode ? styles.modalSubTextDark : styles.modalSubTextLight] },
            'Are you sure you want to delete all?'
          ),
          React.createElement(
            View,
            { style: styles.modalButtonRow },
            React.createElement(
              TouchableOpacity,
              {
                style: [styles.modalButton, styles.modalCancelButton],
                onPress: closeDeleteModal,
                activeOpacity: 0.85
              },
              React.createElement(Text, { style: styles.modalCancelText }, 'Cancel')
            ),
            React.createElement(
              TouchableOpacity,
              {
                style: [styles.modalButton, styles.modalDeleteButton],
                onPress: confirmDeleteChatHistory,
                activeOpacity: 0.85
              },
              React.createElement(Text, { style: styles.modalDeleteText }, 'Delete')
            )
          )
        )
      )
    ),
    React.createElement(
      SafeAreaView,
      { style: styles.safe },
      React.createElement(
        Animated.View,
        { style: [styles.header, isDarkMode ? styles.headerDark : styles.headerLight, headerStyle as any] },
        React.createElement(
          View,
          { style: styles.headerRow },
          React.createElement(
            View,
            { style: styles.headerTextWrap },
            React.createElement(Text, { style: [styles.title, isDarkMode ? styles.titleDark : styles.titleLight] }, 'NewLife AI'),
            React.createElement(Text, { style: [styles.subtitle, isDarkMode ? styles.subtitleDark : styles.subtitleLight] }, `Hi ${props.memberName || 'Member'}. Don't shy to ask me anything...`)
          ),
          React.createElement(
            TouchableOpacity,
            {
              style: styles.trashButton,
              onPress: openDeleteModal,
              activeOpacity: 0.85
            },
            React.createElement(Ionicons, { name: 'trash-outline', size: 22, color: isDarkMode ? '#e5e7eb' : '#111827' })
          )
        )
      ),
      React.createElement(
        Animated.View,
        { style: [styles.contentWrap, screenStyle as any] },
        React.createElement(
          KeyboardAvoidingView,
          {
            style: styles.keyboardAvoid,
            behavior: Platform.OS === 'ios' ? 'padding' : undefined
          },
          React.createElement(
            View,
            { style: styles.contentArea },
            React.createElement(
              ScrollView,
              {
                ref: messagesEndRef,
                scrollEnabled: true,
                style: styles.messagesScroll,
                contentContainerStyle: styles.messagesContent,
                showsVerticalScrollIndicator: true,
                keyboardShouldPersistTaps: 'handled',
                keyboardDismissMode: 'on-drag',
                nestedScrollEnabled: true
              },
              messageNodes,
              loadingGreeting && messages.length === 0
                ? React.createElement(
                    View,
                    { style: [styles.thinkingBubble, isDarkMode ? styles.thinkingDark : styles.thinkingLight] },
                    React.createElement(Text, { style: [styles.thinkingText, isDarkMode ? styles.thinkingTextDark : styles.thinkingTextLight] }, 'AI is thinking...')
                  )
                : null,
              loading && !loadingGreeting && messages.length > 1
                ? React.createElement(
                    View,
                    { style: [styles.thinkingBubble, isDarkMode ? styles.thinkingDark : styles.thinkingLight] },
                    React.createElement(Text, { style: [styles.thinkingText, isDarkMode ? styles.thinkingTextDark : styles.thinkingTextLight] }, 'AI is thinking...')
                  )
                : null
            ),
            React.createElement(
              Animated.View,
              { style: [styles.inputFixedWrap, inputStyle as any] },
              React.createElement(
                View,
                { style: [styles.inputOuter, isDarkMode ? styles.inputOuterDark : styles.inputOuterLight] },
                React.createElement(
                  View,
                  { style: [styles.quickBox, isDarkMode ? styles.quickBoxDark : styles.quickBoxLight] },
                  React.createElement(
                    ScrollView,
                    {
                      horizontal: true,
                      showsHorizontalScrollIndicator: false,
                      contentContainerStyle: styles.quickScrollContent
                    },
                    QUICK_PROMPTS.map(function (prompt) {
                      return React.createElement(
                        TouchableOpacity,
                        {
                          key: prompt,
                          onPress: function () {
                            if (!loading) {
                              sendMessage(prompt)
                            }
                          },
                          activeOpacity: 0.85,
                          style: [styles.quickPrompt, isDarkMode ? styles.quickPromptDark : styles.quickPromptLight]
                        },
                        React.createElement(Text, { style: [styles.quickPromptText, isDarkMode ? styles.quickPromptTextDark : styles.quickPromptTextLight] }, prompt)
                      )
                    })
                  )
                ),
                React.createElement(
                  View,
                  { style: [styles.inputRow, isDarkMode ? styles.inputRowDark : styles.inputRowLight] },
                  React.createElement(TextInput, {
                    style: [styles.textInput, isDarkMode ? styles.textInputDark : styles.textInputLight],
                    value: input,
                    onChangeText: function (t) {
                      setInput(t)
                    },
                    placeholder: loading ? 'Waiting for response...' : 'Type your message here...',
                    placeholderTextColor: isDarkMode ? '#9ca3af' : '#6b7280',
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
                      style: [styles.sendButton, sendDisabled ? styles.sendButtonDisabled : styles.sendButtonEnabled],
                      onPress: function () {
                        if (!sendDisabled) sendMessage()
                      },
                      disabled: sendDisabled,
                      activeOpacity: 0.85
                    },
                    loading
                      ? React.createElement(ActivityIndicator, { color: '#ffffff' })
                      : React.createElement(Ionicons, { name: 'send', size: 20, color: '#ffffff' })
                  )
                )
              )
            )
          )
        )
      )
    )
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1
  },
  rootDark: {
    backgroundColor: '#000000'
  },
  rootLight: {
    backgroundColor: '#f3f4f6'
  },
  safe: {
    flex: 1
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1
  },
  headerDark: {
    backgroundColor: '#1f2937',
    borderBottomColor: '#374151'
  },
  headerLight: {
    backgroundColor: '#ffffff',
    borderBottomColor: '#dbeafe'
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 4,
    paddingVertical: 4
  },
  headerTextWrap: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  title: {
    fontSize: 30,
    fontWeight: '900'
  },
  titleDark: {
    color: '#f3f4f6'
  },
  titleLight: {
    color: '#111827'
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8
  },
  subtitleDark: {
    color: '#9ca3af'
  },
  subtitleLight: {
    color: '#4b5563'
  },
  trashButton: {
    padding: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(239,68,68,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.20)'
  },
  contentWrap: {
    flex: 1
  },
  keyboardAvoid: {
    flex: 1
  },
  contentArea: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden'
  },
  messagesScroll: {
    flex: 1,
    width: '100%'
  },
  messagesContent: {
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 200,
    width: '100%',
    alignItems: 'stretch'
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#0ea5e9',
    borderRadius: 18,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 6,
    flexShrink: 1,
    minWidth: 0
  },
  botBubble: {
    alignSelf: 'flex-start',
    borderRadius: 18,
    borderTopLeftRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginVertical: 6,
    borderWidth: 1,
    flexShrink: 1,
    minWidth: 0
  },
  botBubbleDark: {
    backgroundColor: '#111827',
    borderColor: '#374151'
  },
  botBubbleLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb'
  },
  baseText: {
    fontSize: 16,
    lineHeight: 24,
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0
  },
  normalText: {
    fontSize: 16,
    lineHeight: 24,
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0
  },
  boldText: {
    fontWeight: '700'
  },
  italicText: {
    fontStyle: 'italic'
  },
  codeText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  },
  codeDark: {
    backgroundColor: '#374151',
    color: '#d1d5db'
  },
  codeLight: {
    backgroundColor: '#f3f4f6',
    color: '#111827'
  },
  latexBlock: {
    padding: 8,
    marginVertical: 6,
    borderRadius: 8
  },
  latexInline: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6
  },
  h1: {
    fontSize: 24,
    fontWeight: '800',
    flexWrap: 'wrap'
  },
  h2: {
    fontSize: 20,
    fontWeight: '700',
    flexWrap: 'wrap'
  },
  h3: {
    fontSize: 18,
    fontWeight: '700',
    flexWrap: 'wrap'
  },
  lineGap: {
    marginBottom: 4
  },
  darkText: {
    color: '#f3f4f6'
  },
  lightText: {
    color: '#111827'
  },
  thinkingBubble: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
    marginVertical: 6
  },
  thinkingDark: {
    backgroundColor: '#1f2937'
  },
  thinkingLight: {
    backgroundColor: '#dbeafe'
  },
  thinkingText: {
    fontSize: 16
  },
  thinkingTextDark: {
    color: '#9ca3af'
  },
  thinkingTextLight: {
    color: '#374151'
  },
  inputFixedWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 20
  },
  inputOuter: {
    marginHorizontal: 12,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderRadius: 24
  },
  inputOuterDark: {
    backgroundColor: '#000000',
    borderTopColor: '#374151'
  },
  inputOuterLight: {
    backgroundColor: '#f3f4f6',
    borderTopColor: '#d1d5db'
  },
  quickBox: {
    borderRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    marginBottom: 12
  },
  quickBoxDark: {
    backgroundColor: '#111827',
    borderColor: '#374151'
  },
  quickBoxLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb'
  },
  quickScrollContent: {
    paddingBottom: 2
  },
  quickPrompt: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8
  },
  quickPromptDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151'
  },
  quickPromptLight: {
    backgroundColor: '#f3f4f6',
    borderColor: '#e5e7eb'
  },
  quickPromptText: {
    fontSize: 14,
    fontWeight: '600'
  },
  quickPromptTextDark: {
    color: '#f3f4f6'
  },
  quickPromptTextLight: {
    color: '#1f2937'
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  inputRowDark: {
    backgroundColor: '#1f2937',
    borderColor: '#374151'
  },
  inputRowLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb'
  },
  textInput: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginRight: 10
  },
  textInputDark: {
    color: '#f3f4f6'
  },
  textInputLight: {
    color: '#111827'
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center'
  },
  sendButtonEnabled: {
    backgroundColor: '#16a34a'
  },
  sendButtonDisabled: {
    backgroundColor: '#d1d5db'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20
  },
  modalCard: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 18,
    borderWidth: 1
  },
  modalCardDark: {
    backgroundColor: '#111827',
    borderColor: '#374151'
  },
  modalCardLight: {
    backgroundColor: '#ffffff',
    borderColor: '#e5e7eb'
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center'
  },
  modalMessage: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 18
  },
  modalTextDark: {
    color: '#f3f4f6'
  },
  modalTextLight: {
    color: '#111827'
  },
  modalSubTextDark: {
    color: '#d1d5db'
  },
  modalSubTextLight: {
    color: '#4b5563'
  },
  modalButtonRow: {
    flexDirection: 'row',
    gap: 12
  },
  modalButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  modalCancelButton: {
    backgroundColor: '#e5e7eb'
  },
  modalDeleteButton: {
    backgroundColor: '#dc2626'
  },
  modalCancelText: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '700'
  },
  modalDeleteText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700'
  }
})