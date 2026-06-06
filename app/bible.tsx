import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useColorScheme } from "nativewind";
import { MaterialIcons } from "@expo/vector-icons";

interface BibleBook {
  name: string;
  abbreviation: string;
  chapters: number;
}

interface Verse {
  text: string;
  verseNumber: number;
}

interface VerseRange {
  start: number;
  end: number;
}

const STORAGE_KEY = "bible_last_search_v3";

const BIBLE_BOOKS: BibleBook[] = [
  { name: "Genesis", abbreviation: "Gen", chapters: 50 },
  { name: "Exodus", abbreviation: "Exo", chapters: 40 },
  { name: "Leviticus", abbreviation: "Lev", chapters: 27 },
  { name: "Numbers", abbreviation: "Num", chapters: 36 },
  { name: "Deuteronomy", abbreviation: "Deu", chapters: 34 },
  { name: "Joshua", abbreviation: "Jos", chapters: 24 },
  { name: "Judges", abbreviation: "Jdg", chapters: 21 },
  { name: "Ruth", abbreviation: "Rut", chapters: 4 },
  { name: "1 Samuel", abbreviation: "1Sa", chapters: 31 },
  { name: "2 Samuel", abbreviation: "2Sa", chapters: 24 },
  { name: "1 Kings", abbreviation: "1Ki", chapters: 22 },
  { name: "2 Kings", abbreviation: "2Ki", chapters: 25 },
  { name: "1 Chronicles", abbreviation: "1Ch", chapters: 29 },
  { name: "2 Chronicles", abbreviation: "2Ch", chapters: 36 },
  { name: "Ezra", abbreviation: "Ezr", chapters: 10 },
  { name: "Nehemiah", abbreviation: "Neh", chapters: 13 },
  { name: "Esther", abbreviation: "Est", chapters: 10 },
  { name: "Job", abbreviation: "Job", chapters: 42 },
  { name: "Psalms", abbreviation: "Psa", chapters: 150 },
  { name: "Proverbs", abbreviation: "Pro", chapters: 31 },
  { name: "Ecclesiastes", abbreviation: "Ecc", chapters: 12 },
  { name: "Isaiah", abbreviation: "Isa", chapters: 66 },
  { name: "Jeremiah", abbreviation: "Jer", chapters: 52 },
  { name: "Lamentations", abbreviation: "Lam", chapters: 5 },
  { name: "Ezekiel", abbreviation: "Eze", chapters: 48 },
  { name: "Daniel", abbreviation: "Dan", chapters: 12 },
  { name: "Hosea", abbreviation: "Hos", chapters: 14 },
  { name: "Joel", abbreviation: "Joe", chapters: 3 },
  { name: "Amos", abbreviation: "Amo", chapters: 9 },
  { name: "Obadiah", abbreviation: "Oba", chapters: 1 },
  { name: "Jonah", abbreviation: "Jon", chapters: 4 },
  { name: "Micah", abbreviation: "Mic", chapters: 7 },
  { name: "Nahum", abbreviation: "Nah", chapters: 3 },
  { name: "Habakkuk", abbreviation: "Hab", chapters: 3 },
  { name: "Zephaniah", abbreviation: "Zep", chapters: 3 },
  { name: "Haggai", abbreviation: "Hag", chapters: 2 },
  { name: "Zechariah", abbreviation: "Zec", chapters: 14 },
  { name: "Malachi", abbreviation: "Mal", chapters: 4 },
  { name: "Matthew", abbreviation: "Mat", chapters: 28 },
  { name: "Mark", abbreviation: "Mar", chapters: 16 },
  { name: "Luke", abbreviation: "Luk", chapters: 24 },
  { name: "John", abbreviation: "Joh", chapters: 21 },
  { name: "Acts", abbreviation: "Act", chapters: 28 },
  { name: "Romans", abbreviation: "Rom", chapters: 16 },
  { name: "1 Corinthians", abbreviation: "1Co", chapters: 16 },
  { name: "2 Corinthians", abbreviation: "2Co", chapters: 13 },
  { name: "Galatians", abbreviation: "Gal", chapters: 6 },
  { name: "Ephesians", abbreviation: "Eph", chapters: 6 },
  { name: "Philippians", abbreviation: "Phi", chapters: 4 },
  { name: "Colossians", abbreviation: "Col", chapters: 4 },
  { name: "1 Thessalonians", abbreviation: "1Th", chapters: 5 },
  { name: "2 Thessalonians", abbreviation: "2Th", chapters: 3 },
  { name: "1 Timothy", abbreviation: "1Ti", chapters: 6 },
  { name: "2 Timothy", abbreviation: "2Ti", chapters: 4 },
  { name: "Titus", abbreviation: "Tit", chapters: 3 },
  { name: "Philemon", abbreviation: "Phm", chapters: 1 },
  { name: "Hebrews", abbreviation: "Heb", chapters: 13 },
  { name: "James", abbreviation: "Jam", chapters: 5 },
  { name: "1 Peter", abbreviation: "1Pe", chapters: 5 },
  { name: "2 Peter", abbreviation: "2Pe", chapters: 3 },
  { name: "1 John", abbreviation: "1Jo", chapters: 5 },
  { name: "2 John", abbreviation: "2Jo", chapters: 1 },
  { name: "3 John", abbreviation: "3Jo", chapters: 1 },
  { name: "Jude", abbreviation: "Jud", chapters: 1 },
  { name: "Revelation", abbreviation: "Rev", chapters: 22 },
];

const BIBLE_VERSIONS = [
  { label: "KJV", value: "kjv" },
  { label: "ASV", value: "asv" },
  { label: "WEB", value: "web" },
  { label: "Darby", value: "darby" },
  { label: "YLT", value: "ylt" },
];

const DEFAULT_BOOK = BIBLE_BOOKS[0];
const DEFAULT_CHAPTER = 1;
const DEFAULT_VERSION = "kjv";

const calculateLevenshteinDistance = (a: string, b: string): number => {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      if (bLower[i - 1] === aLower[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[bLower.length][aLower.length];
};

const fuzzyMatchBook = (input: string): BibleBook | null => {
  const cleaned = input.trim();
  if (!cleaned) return null;

  const exactMatch = BIBLE_BOOKS.find(
    (book) => book.name.toLowerCase() === cleaned.toLowerCase()
  );
  if (exactMatch) return exactMatch;

  const abbrevMatch = BIBLE_BOOKS.find(
    (book) => book.abbreviation.toLowerCase() === cleaned.toLowerCase()
  );
  if (abbrevMatch) return abbrevMatch;

  const matches = BIBLE_BOOKS.map((book) => ({
    book,
    distance: calculateLevenshteinDistance(cleaned, book.name),
  }))
    .sort((a, b) => a.distance - b.distance)
    .filter((m) => m.distance <= Math.ceil(cleaned.length * 0.4));

  return matches.length > 0 ? matches[0].book : null;
};

const parseVerseSelection = (input: string): VerseRange | null => {
  const cleaned = input.trim().replace(/\s+/g, "");
  if (!cleaned) return null;

  const rangeMatch = cleaned.match(/^(\d+)-(\d+)$/);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start < 1 || end < 1) return null;
    return start <= end ? { start, end } : { start: end, end: start };
  }

  const singleMatch = cleaned.match(/^(\d+)$/);
  if (singleMatch) {
    const verse = parseInt(singleMatch[1], 10);
    if (verse < 1) return null;
    return { start: verse, end: verse };
  }

  return null;
};

const fetchVerses = async (
  book: string,
  chapter: number,
  version: string
): Promise<{ verses: Verse[]; reference: string } | null> => {
  try {
    const reference = `${book} ${chapter}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(
      `https://bible-api.com/${encodeURIComponent(reference)}?translation=${encodeURIComponent(
        version
      )}`,
      { signal: controller.signal }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.verses) || data.verses.length === 0) {
      return null;
    }

    const verses: Verse[] = data.verses.map((v: any) => ({
      verseNumber: Number(v.verse),
      text: String(v.text ?? "").trim(),
    }));

    return {
      verses: verses.sort((a, b) => a.verseNumber - b.verseNumber),
      reference: data.reference || reference,
    };
  } catch (error) {
    console.error("Error fetching verses:", error);
    return null;
  }
};

interface BibleProps {
  userId?: string;
  userRole?: string;
  memberName?: string;
  userEmail?: string;
  memberId?: string;
  colorScheme?: string;
  isLandscape?: boolean;
}

export default function Bible(props: BibleProps) {
  const { colorScheme } = useColorScheme();
  const { width } = useWindowDimensions();
  const isCompact = width < 700;

  const [step, setStep] = useState<"book" | "chapter" | "verse">("book");
  const [bookInput, setBookInput] = useState(DEFAULT_BOOK.name);
  const [chapterInput, setChapterInput] = useState(String(DEFAULT_CHAPTER));
  const [verseInput, setVerseInput] = useState("");
  const [selectedBook, setSelectedBook] = useState<BibleBook>(DEFAULT_BOOK);
  const [selectedChapter, setSelectedChapter] = useState<number>(DEFAULT_CHAPTER);
  const [selectedVersion, setSelectedVersion] = useState(DEFAULT_VERSION);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [selectedRange, setSelectedRange] = useState<VerseRange | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [versionMenuOpen, setVersionMenuOpen] = useState(false);
  const [ready, setReady] = useState(false);

  const bookInputRef = useRef<TextInput>(null);
  const chapterInputRef = useRef<TextInput>(null);
  const verseInputRef = useRef<TextInput>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const verseYPositions = useRef<Record<number, number>>({});
  const pendingScrollVerseRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const submitLockRef = useRef(0);

  const isDark = colorScheme === "dark";

  const currentVersionLabel = useMemo(() => {
    return (
      BIBLE_VERSIONS.find((item) => item.value === selectedVersion)?.label ||
      selectedVersion.toUpperCase()
    );
  }, [selectedVersion]);

  const chapterHeaderText = useMemo(() => {
    return `verses 1-${Math.max(verses.length, 1)}`;
  }, [verses.length]);

  const saveState = useCallback(
    async (
      nextStep: "book" | "chapter" | "verse",
      nextBook: BibleBook,
      nextChapter: number,
      nextVerseInput: string,
      nextRange: VerseRange | null
    ) => {
      const payload = {
        step: nextStep,
        version: selectedVersion,
        bookInput: nextBook.name,
        chapterInput: String(nextChapter),
        verseInput: nextVerseInput,
        selectedBookName: nextBook.name,
        selectedChapter: nextChapter,
        selectedRange: nextRange,
      };
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch {}
    },
    [selectedVersion]
  );

  const scrollToVerse = useCallback((verseNumber: number) => {
    const y = verseYPositions.current[verseNumber];
    if (typeof y === "number" && scrollViewRef.current) {
      scrollViewRef.current.scrollTo({
        y: Math.max(0, y - 24),
        animated: true,
      });
      pendingScrollVerseRef.current = null;
    }
  }, []);

  const loadChapter = useCallback(
    async (
      book: BibleBook,
      chapter: number,
      range: VerseRange | null,
      preserveRange = false
    ) => {
      setLoading(true);
      setError("");

      const result = await fetchVerses(book.name, chapter, selectedVersion);

      if (!isMountedRef.current) return;

      if (result) {
        setSelectedBook(book);
        setSelectedChapter(chapter);
        setVerses(result.verses);
        if (!preserveRange) {
          setSelectedRange(range);
        } else {
          setSelectedRange((prev) => prev ?? range);
        }
        verseYPositions.current = {};
      } else {
        setError("Could not fetch verses right now. Please try again.");
        setVerses([]);
        setSelectedRange(null);
      }

      setLoading(false);
    },
    [selectedVersion]
  );

  useEffect(() => {
    isMountedRef.current = true;

    const restore = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          await loadChapter(DEFAULT_BOOK, DEFAULT_CHAPTER, null, false);
          setReady(true);
          return;
        }

        const saved = JSON.parse(raw);
        const savedBook = BIBLE_BOOKS.find(
          (book) =>
            book.name.toLowerCase() ===
            String(saved?.selectedBookName ?? "").toLowerCase()
        );

        const nextBook = savedBook || DEFAULT_BOOK;
        const nextChapter =
          Number(saved?.selectedChapter ?? DEFAULT_CHAPTER) || DEFAULT_CHAPTER;
        const nextRange = saved?.selectedRange ?? null;
        const nextStep = saved?.step || "book";
        const nextVersion = saved?.version || DEFAULT_VERSION;

        setSelectedVersion(nextVersion);
        setBookInput(String(saved?.bookInput ?? nextBook.name));
        setChapterInput(String(saved?.chapterInput ?? nextChapter));
        setVerseInput(String(saved?.verseInput ?? ""));
        setStep(nextStep);

        await loadChapter(nextBook, nextChapter, nextRange, false);
        setReady(true);
      } catch {
        await loadChapter(DEFAULT_BOOK, DEFAULT_CHAPTER, null, false);
        setReady(true);
      }
    };

    restore();

    return () => {
      isMountedRef.current = false;
    };
  }, [loadChapter]);

  useEffect(() => {
    if (!ready) return;
    const save = async () => {
      await saveState(step, selectedBook, selectedChapter, verseInput, selectedRange);
    };
    save();
  }, [ready, step, selectedBook, selectedChapter, verseInput, selectedRange, saveState]);

  useEffect(() => {
    if (!ready) return;
    if (!selectedBook || !selectedChapter) return;
    loadChapter(selectedBook, selectedChapter, selectedRange, true);
  }, [selectedVersion]);

  useEffect(() => {
    if (step === "book") {
      setTimeout(() => bookInputRef.current?.focus(), 120);
    } else if (step === "chapter") {
      setTimeout(() => chapterInputRef.current?.focus(), 120);
    } else if (step === "verse") {
      setTimeout(() => verseInputRef.current?.focus(), 120);
    }
  }, [step]);

  useEffect(() => {
    if (selectedRange && verses.length > 0) {
      pendingScrollVerseRef.current = selectedRange.start;
      const timer = setTimeout(() => {
        scrollToVerse(selectedRange.start);
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [selectedRange, verses.length, scrollToVerse]);

  const canSubmitNow = useCallback(() => {
    const now = Date.now();
    if (now - submitLockRef.current < 250) return false;
    submitLockRef.current = now;
    return true;
  }, []);

  const handleBookSubmit = useCallback(async () => {
    if (!canSubmitNow()) return;

    const matched = fuzzyMatchBook(bookInput);
    if (!matched) {
      setError('Book not found. Try again. (e.g., "Genesis", "John", "Psalms")');
      return;
    }

    setSelectedBook(matched);
    setBookInput(matched.name);
    setChapterInput("");
    setVerseInput("");
    setSelectedRange(null);
    setError("");
    setStep("chapter");
    await saveState("chapter", matched, selectedChapter || DEFAULT_CHAPTER, "", null);
  }, [bookInput, canSubmitNow, saveState, selectedChapter]);

  const handleChapterSubmit = useCallback(async () => {
    if (!canSubmitNow()) return;

    const chapter = parseInt(chapterInput, 10);
    if (!selectedBook || isNaN(chapter) || chapter < 1) {
      setError("Please enter a valid chapter number");
      return;
    }

    const finalChapter = Math.min(chapter, selectedBook.chapters);
    setSelectedChapter(finalChapter);
    setChapterInput(String(finalChapter));
    setVerseInput("");
    setSelectedRange(null);
    setStep("verse");
    await loadChapter(selectedBook, finalChapter, null, false);
    await saveState("verse", selectedBook, finalChapter, "", null);
  }, [chapterInput, selectedBook, canSubmitNow, loadChapter, saveState]);

  const handleVerseSubmit = useCallback(async () => {
    if (!canSubmitNow()) return;

    const parsed = parseVerseSelection(verseInput);

    if (!parsed) {
      setError('Enter a valid verse number or range like "12" or "12-15"');
      return;
    }

    if (verses.length === 0) {
      setError("Chapter verses are not loaded yet");
      return;
    }

    const maxVerse = verses.length;
    if (parsed.start > maxVerse) {
      setError(`This chapter only has ${maxVerse} verses`);
      return;
    }

    const finalRange: VerseRange = {
      start: parsed.start,
      end: Math.min(parsed.end, maxVerse),
    };

    setSelectedRange(finalRange);
    setError("");
    pendingScrollVerseRef.current = finalRange.start;
    await saveState("verse", selectedBook, selectedChapter, verseInput, finalRange);
    setTimeout(() => scrollToVerse(finalRange.start), 150);
  }, [
    verseInput,
    verses,
    canSubmitNow,
    saveState,
    selectedBook,
    selectedChapter,
    scrollToVerse,
  ]);

  const submitByStep = useCallback(() => {
    if (step === "book") {
      handleBookSubmit();
    } else if (step === "chapter") {
      handleChapterSubmit();
    } else {
      handleVerseSubmit();
    }
  }, [step, handleBookSubmit, handleChapterSubmit, handleVerseSubmit]);

  const handleKeyPress = useCallback(
    (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      const key = e.nativeEvent.key;
      if (key === " " || key === "Spacebar" || key === "Enter") {
        submitByStep();
      }
    },
    [submitByStep]
  );

  const handleVersionSelect = useCallback(
    async (version: string) => {
      setSelectedVersion(version);
      setVersionMenuOpen(false);
      await saveState(step, selectedBook, selectedChapter, verseInput, selectedRange);
    },
    [saveState, step, selectedBook, selectedChapter, verseInput, selectedRange]
  );

  const handleResetAll = useCallback(async () => {
    setStep("book");
    setBookInput(DEFAULT_BOOK.name);
    setChapterInput(String(DEFAULT_CHAPTER));
    setVerseInput("");
    setSelectedBook(DEFAULT_BOOK);
    setSelectedChapter(DEFAULT_CHAPTER);
    setSelectedRange(null);
    setSelectedVersion(DEFAULT_VERSION);
    setError("");
    setVersionMenuOpen(false);
    await loadChapter(DEFAULT_BOOK, DEFAULT_CHAPTER, null, false);
    await saveState("book", DEFAULT_BOOK, DEFAULT_CHAPTER, "", null);
  }, [loadChapter, saveState]);

  const handleChangeBook = useCallback(() => {
    setStep("book");
    setTimeout(() => bookInputRef.current?.focus(), 120);
  }, []);

  const handleChangeChapter = useCallback(() => {
    setStep("chapter");
    setTimeout(() => chapterInputRef.current?.focus(), 120);
  }, []);

  const highlightedVerses = useMemo(() => {
    return verses.map((verse) => {
      const isSelected =
        selectedRange &&
        verse.verseNumber >= selectedRange.start &&
        verse.verseNumber <= selectedRange.end;

      return (
        <View
          key={verse.verseNumber}
          onLayout={(event) => {
            verseYPositions.current[verse.verseNumber] = event.nativeEvent.layout.y;
            if (pendingScrollVerseRef.current === verse.verseNumber) {
              scrollToVerse(verse.verseNumber);
            }
          }}
          style={[
            styles.verseRow,
            {
              backgroundColor: isSelected
                ? isDark
                  ? "#1D4ED8"
                  : "#DBEAFE"
                : "transparent",
              borderColor: isSelected
                ? isDark
                  ? "#3B82F6"
                  : "#93C5FD"
                : "transparent",
            },
          ]}
        >
          <Text
            style={[
              styles.verseNumber,
              {
                color: isSelected
                  ? isDark
                    ? "#FFFFFF"
                    : "#1D4ED8"
                  : isDark
                  ? "#93C5FD"
                  : "#2563EB",
              },
            ]}
          >
            {verse.verseNumber}
          </Text>
          <Text
            style={[
              styles.verseRowText,
              {
                color: isDark ? "#E5E7EB" : "#1F2937",
                fontWeight: isSelected ? "700" : "500",
              },
            ]}
          >
            {verse.text}
          </Text>
        </View>
      );
    });
  }, [verses, selectedRange, isDark, scrollToVerse]);

  const selectedRangeLabel =
    selectedRange && selectedRange.start !== selectedRange.end
      ? `verses ${selectedRange.start}-${selectedRange.end}`
      : selectedRange
      ? `verse ${selectedRange.start}`
      : chapterHeaderText;

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? "#1F2937" : "#FFFFFF" },
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={[styles.title, { color: isDark ? "#FFFFFF" : "#111827" }]}>
            🕯️ Bible Verses
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? "#9CA3AF" : "#6B7280" }]}>
            Book, chapter, and verse input one at a time
          </Text>
        </View>

        <View
          style={[
            styles.topRow,
            isCompact ? styles.topRowCompact : styles.topRowWide,
          ]}
        >
          <View
            style={[
              styles.versionBlock,
              isCompact ? styles.blockFull : styles.versionBlockWide,
            ]}
          >
            <Text
              style={[styles.label, { color: isDark ? "#E5E7EB" : "#374151" }]}
            >
              Bible Version
            </Text>

            <View style={styles.versionWrapper}>
              <Pressable
                style={[
                  styles.dropdownButton,
                  {
                    backgroundColor: isDark ? "#111827" : "#F9FAFB",
                    borderColor: isDark ? "#374151" : "#D1D5DB",
                  },
                ]}
                onPress={() => setVersionMenuOpen((prev) => !prev)}
              >
                <Text
                  style={[
                    styles.dropdownButtonText,
                    { color: isDark ? "#FFFFFF" : "#111827" },
                  ]}
                >
                  {currentVersionLabel}
                </Text>
                <MaterialIcons
                  name={versionMenuOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
                  size={22}
                  color={isDark ? "#E5E7EB" : "#374151"}
                />
              </Pressable>

              {versionMenuOpen && (
                <View
                  style={[
                    styles.dropdownMenu,
                    {
                      backgroundColor: isDark ? "#111827" : "#FFFFFF",
                      borderColor: isDark ? "#374151" : "#D1D5DB",
                    },
                  ]}
                >
                  <ScrollView
                    style={styles.dropdownScroll}
                    contentContainerStyle={styles.dropdownScrollContent}
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                  >
                    {BIBLE_VERSIONS.map((item) => {
                      const active = item.value === selectedVersion;
                      return (
                        <Pressable
                          key={item.value}
                          style={[
                            styles.dropdownItem,
                            active && {
                              backgroundColor: isDark ? "#1D4ED8" : "#DBEAFE",
                            },
                          ]}
                          onPress={() => handleVersionSelect(item.value)}
                        >
                          <Text
                            style={[
                              styles.dropdownItemText,
                              {
                                color: active
                                  ? isDark
                                    ? "#FFFFFF"
                                    : "#1D4ED8"
                                  : isDark
                                  ? "#E5E7EB"
                                  : "#111827",
                              },
                            ]}
                          >
                            {item.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              )}
            </View>

            {selectedVersion === "niv" && (
              <Text
                style={[
                  styles.versionNote,
                  { color: isDark ? "#FBBF24" : "#B45309" },
                ]}
              >
                NIV is not provided by this API, so WEB is used for fetching.
              </Text>
            )}
          </View>

          <View
            style={[
              styles.referenceBlock,
              isCompact ? styles.blockFull : styles.referenceBlockWide,
            ]}
          >
            {step === "book" && (
              <>
                <Text
                  style={[styles.label, { color: isDark ? "#E5E7EB" : "#374151" }]}
                >
                  Book
                </Text>
                <View style={styles.referenceRow}>
                  <TextInput
                    ref={bookInputRef}
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? "#111827" : "#F9FAFB",
                        borderColor: isDark ? "#374151" : "#D1D5DB",
                        color: isDark ? "#FFFFFF" : "#000",
                      },
                    ]}
                    placeholder="e.g., Genesis, John, Psalms..."
                    placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                    value={bookInput}
                    onChangeText={(text) => {
                      setBookInput(text);
                      setError("");
                    }}
                    onSubmitEditing={handleBookSubmit}
                    onKeyPress={handleKeyPress}
                    returnKeyType="done"
                    autoCorrect={false}
                    autoCapitalize="words"
                  />
                  <Pressable
                    style={[
                      styles.submitButton,
                      { backgroundColor: bookInput.trim() ? "#2563EB" : "#9CA3AF" },
                    ]}
                    onPress={handleBookSubmit}
                    disabled={!bookInput.trim() || loading}
                  >
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            )}

            {step === "chapter" && (
              <>
                <Text
                  style={[styles.label, { color: isDark ? "#E5E7EB" : "#374151" }]}
                >
                  Chapter
                </Text>
                <View style={styles.referenceRow}>
                  <TextInput
                    ref={chapterInputRef}
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? "#111827" : "#F9FAFB",
                        borderColor: isDark ? "#374151" : "#D1D5DB",
                        color: isDark ? "#FFFFFF" : "#000",
                      },
                    ]}
                    placeholder={`1 to ${selectedBook.chapters}`}
                    placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                    value={chapterInput}
                    onChangeText={(text) => {
                      setChapterInput(text);
                      setError("");
                    }}
                    onSubmitEditing={handleChapterSubmit}
                    onKeyPress={handleKeyPress}
                    keyboardType="number-pad"
                    returnKeyType="done"
                  />
                  <Pressable
                    style={[
                      styles.submitButton,
                      { backgroundColor: chapterInput.trim() ? "#2563EB" : "#9CA3AF" },
                    ]}
                    onPress={handleChapterSubmit}
                    disabled={!chapterInput.trim() || loading}
                  >
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            )}

            {step === "verse" && (
              <>
                <Text
                  style={[styles.label, { color: isDark ? "#E5E7EB" : "#374151" }]}
                >
                  Verse
                </Text>
                <View style={styles.referenceRow}>
                  <TextInput
                    ref={verseInputRef}
                    style={[
                      styles.input,
                      {
                        backgroundColor: isDark ? "#111827" : "#F9FAFB",
                        borderColor: isDark ? "#374151" : "#D1D5DB",
                        color: isDark ? "#FFFFFF" : "#000",
                      },
                    ]}
                    placeholder="e.g., 12 or 12-15"
                    placeholderTextColor={isDark ? "#6B7280" : "#9CA3AF"}
                    value={verseInput}
                    onChangeText={(text) => {
                      setVerseInput(text);
                      setError("");
                    }}
                    onSubmitEditing={handleVerseSubmit}
                    onKeyPress={handleKeyPress}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={[
                      styles.submitButton,
                      { backgroundColor: verseInput.trim() ? "#2563EB" : "#9CA3AF" },
                    ]}
                    onPress={handleVerseSubmit}
                    disabled={!verseInput.trim() || loading}
                  >
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </Pressable>
                </View>
              </>
            )}
          </View>

          <View
            style={[
              styles.rightButtons,
              isCompact ? styles.rightButtonsCompact : styles.rightButtonsWide,
            ]}
          >
            {step === "chapter" && (
              <Pressable style={styles.sideButton} onPress={handleChangeBook}>
                <Text style={styles.sideButtonText}>Change Book</Text>
              </Pressable>
            )}
            {step === "verse" && (
              <Pressable style={styles.sideButton} onPress={handleChangeChapter}>
                <Text style={styles.sideButtonText}>Change Chapter</Text>
              </Pressable>
            )}
            <Pressable style={styles.sideButton} onPress={handleResetAll}>
              <Text style={styles.sideButtonText}>Reset All</Text>
            </Pressable>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2563EB" />
            <Text
              style={{ color: isDark ? "#E5E7EB" : "#6B7280", marginTop: 12 }}
            >
              Loading verses...
            </Text>
          </View>
        )}

        {!loading && verses.length > 0 && (
          <View
            style={[
              styles.chapterContainer,
              { backgroundColor: isDark ? "#111827" : "#F9FAFB" },
            ]}
          >
            <View style={styles.chapterHeader}>
              <Text
                style={[
                  styles.chapterTitle,
                  { color: isDark ? "#FFFFFF" : "#111827" },
                ]}
              >
                {selectedBook.name} {selectedChapter}{" "}
                <Text
                  style={[
                    styles.chapterSubTitle,
                    { color: isDark ? "#9CA3AF" : "#6B7280" },
                  ]}
                >
                  {selectedRange ? selectedRangeLabel : chapterHeaderText}
                </Text>
              </Text>
            </View>

            <View style={styles.versesList}>{highlightedVerses}</View>
          </View>
        )}

        {!loading && verses.length === 0 && !error ? (
          <View style={styles.emptyContainer}>
            <Text
              style={{
                color: isDark ? "#9CA3AF" : "#6B7280",
                textAlign: "center",
              }}
            >
              No verses loaded yet
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: "visible",
  },
  scrollView: {
    flex: 1,
    overflow: "visible",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
    overflow: "visible",
  },
  header: {
    marginBottom: 18,
    position: "relative",
    zIndex: 1,
    elevation: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  topRow: {
    gap: 12,
    marginBottom: 14,
    overflow: "visible",
    position: "relative",
    zIndex: 20,
    elevation: 20,
  },
  topRowCompact: {
    flexDirection: "column",
  },
  topRowWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  versionBlock: {
    position: "relative",
    zIndex: 99999,
    elevation: 99999,
    overflow: "visible",
  },
  versionBlockWide: {
    width: 160,
    flexShrink: 0,
  },
  versionWrapper: {
    position: "relative",
    zIndex: 99999,
    elevation: 99999,
    overflow: "visible",
  },
  versionNote: {
    marginTop: 8,
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "400",
  },
  dropdownButton: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
    paddingRight: 10,
  },
  dropdownMenu: {
    position: "absolute",
    top: 54,
    left: 0,
    right: 0,
    zIndex: 100000,
    elevation: 100000,
    borderWidth: 1.5,
    borderRadius: 12,
    maxHeight: 240,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  dropdownScrollContent: {
    padding: 8,
  },
  dropdownItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  dropdownItemText: {
    fontSize: 14,
    fontWeight: "700",
  },
  referenceBlock: {
    flex: 1,
    overflow: "visible",
    position: "relative",
    zIndex: 5,
    elevation: 5,
  },
  referenceBlockWide: {
    flex: 1,
  },
  blockFull: {
    width: "100%",
  },
  rightButtons: {
    gap: 8,
    justifyContent: "flex-start",
    overflow: "visible",
    position: "relative",
    zIndex: 5,
    elevation: 5,
  },
  rightButtonsWide: {
    width: 110,
    flexShrink: 0,
  },
  rightButtonsCompact: {
    width: "100%",
    flexDirection: "row",
    flexWrap: "wrap",
  },
  sideButton: {
    minHeight: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 10,
    backgroundColor: "rgba(37, 99, 235, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(37, 99, 235, 0.20)",
  },
  sideButtonText: {
    color: "#2563EB",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  label: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },
  referenceRow: {
    flexDirection: "row",
    gap: 10,
    overflow: "visible",
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    fontSize: 15,
    fontWeight: "500",
  },
  submitButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  error: {
    color: "#EF4444",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 4,
    marginBottom: 10,
    position: "relative",
    zIndex: 1,
    elevation: 1,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  chapterContainer: {
    position: "relative",
    zIndex: 0,
    elevation: 0,
    borderRadius: 14,
    padding: 16,
    marginTop: 10,
  },
  chapterHeader: {
    marginBottom: 14,
  },
  chapterTitle: {
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  chapterSubTitle: {
    fontSize: 12,
    fontStyle: "italic",
    fontWeight: "400",
  },
  versesList: {
    position: "relative",
    zIndex: 0,
    elevation: 0,
    gap: 10,
  },
  verseRow: {
    flexDirection: "row",
    gap: 10,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  verseNumber: {
    width: 28,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "right",
    marginTop: 1,
  },
  verseRowText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 23,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
});