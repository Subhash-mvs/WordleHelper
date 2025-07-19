# 🎯 Wordle Solver Chrome Extension

An intelligent Chrome extension that helps solve Wordle puzzles by analyzing game state and suggesting optimal words.

## ✨ Features

- **Smart Analysis**: Automatically reads game board and analyzes letter patterns
- **Answer Suggestions**: Provides possible answers based on current clues
- **Eliminator Words**: Suggests strategic words to narrow down possibilities
- **Manual Entry Detection**: Adapts to user's manual word entries
- **Invalid Word Handling**: Automatically removes invalid words from suggestions
- **State Persistence**: Remembers game progress across sessions

## 🚀 Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the extension folder
5. The Wordle Solver icon should appear in your extensions

## 🎮 Usage

1. **Navigate to Wordle**: Go to [Wordle](https://www.nytimes.com/games/wordle/index.html) and [Wordly](https://wordly.org/)
2. **Open Extension**: Click the Wordle Solver icon in your toolbar
3. **Start Game**: Click "Start Game" to begin with optimal starting words
4. **Get Suggestions**: Click "Analyze & Find Words" after each attempt
5. **Choose Words**: Select from suggested answers or eliminator words

## 🧠 How It Works

### Starting Strategy
The extension begins with three optimal words:
- **moist** - Tests common vowels and consonants
- **lunch** - Tests different letter combinations  
- **ready** - Covers remaining high-frequency letters

### Word Categories

**🎯 Possible Answers**: Direct candidates that could be the solution

**🔍 Eliminator Words**: Strategic words that help distinguish between similar candidates
- Tests differing letters between possible answers
- Combines differing letters with untested letters
- Helps narrow down options efficiently

### Smart Features

- **Adaptive Start**: Only types needed words if you've already started
- **Manual Detection**: Recognizes when you enter words manually
- **Invalid Handling**: Removes rejected words and shows updated suggestions
- **Real-time Updates**: Monitors game state changes automatically

## 🛠️ Technical Details

- **Permissions**: `activeTab`, `scripting`
- **Supported Sites**: NYTimes Wordle, PowerLanguage Wordle
- **Word Database**: 5000+ valid 5-letter words
- **Framework**: Vanilla JavaScript

## 📊 Analysis Algorithm

The extension uses sophisticated pattern matching:

1. **Correct Letters**: Green tiles (right letter, right position)
2. **Misplaced Letters**: Yellow tiles (right letter, wrong position)  
3. **Absent Letters**: Gray tiles (letter not in word)
4. **Untested Letters**: Letters not yet tried

## 🔧 Development

### File Structure
```
├── manifest.json      # Extension configuration
├── popup.html        # Extension popup interface
├── popup.js          # Main logic and UI handling
├── content.js        # Page interaction and DOM reading
├── output.txt        # Word database
└── README.md         # Documentation
```

### Building
No build process required - it's vanilla JavaScript!

**Happy Wordling! 🎉**
