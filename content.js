// Content script that runs on web pages to interact with the keyboard and analyze game state
function findKeyboardButton(letter) {
  // Try new format first
  let buttons = document.querySelectorAll('[data-key]');
  for (let button of buttons) {
    if (button.getAttribute('data-key') === letter.toLowerCase()) {
      return button;
    }
  }
  
  // Fallback to old format
  buttons = document.querySelectorAll('.Game-keyboard-button');
  for (let button of buttons) {
    if (button.textContent.trim().toLowerCase() === letter.toLowerCase()) {
      return button;
    }
  }
  return null;
}

function findEnterButton() {
  // Try new format first
  let button = document.querySelector('[data-key="↵"]');
  if (button) return button;
  
  // Fallback to old format
  const buttons = document.querySelectorAll('.Game-keyboard-button');
  for (let button of buttons) {
    if (button.textContent.trim() === 'Enter') {
      return button;
    }
  }
  return null;
}

function findBackspaceButton() {
  // Try new format first
  let button = document.querySelector('[data-key="←"]');
  if (button) return button;
  
  // Fallback to old format
  const buttons = document.querySelectorAll('.Game-keyboard-button');
  for (let button of buttons) {
    if (button.querySelector('svg') && button.classList.contains('Game-keyboard-button-wide')) {
      return button;
    }
  }
  return null;
}

function clickButton(button) {
  if (button) {
    // Simple single click - avoid multiple events
    button.click();
    return true;
  }
  return false;
}

async function clearCurrentInput() {
  // Clear any existing input by pressing backspace multiple times
  const backspaceButton = findBackspaceButton();
  if (backspaceButton) {
    for (let i = 0; i < 5; i++) {
      backspaceButton.click();
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

async function typeWord(word, delay = 500) {
  // Clear existing input first
  await clearCurrentInput();
  await new Promise(resolve => setTimeout(resolve, 200));
  
  const letters = word.split('');
  let successCount = 0;
  
  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    const button = findKeyboardButton(letter);
    
    if (button) {
      // Single click with explicit delay
      button.click();
      successCount++;
      
      // Always wait between letters, even for the last one
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  return {
    success: successCount === letters.length,
    message: successCount === letters.length 
      ? `Successfully typed "${word}"!` 
      : `Typed ${successCount}/${letters.length} letters of "${word}"`
  };
}

function getLastRowPattern() {
  // Try new format first
  const newBoard = document.querySelector('.Board-module_board__jeoPS');
  if (newBoard) {
    const rows = newBoard.querySelectorAll('.Row-module_row__pwpBq');
    let lastCompletedRow = null;
    
    for (let row of rows) {
      const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');
      const hasContent = Array.from(tiles).every(tile => 
        tile.getAttribute('data-state') !== 'empty'
      );
      
      if (hasContent) {
        lastCompletedRow = row;
      }
    }
    
    if (!lastCompletedRow) {
      return {
        success: false,
        message: 'No completed rows found'
      };
    }
    
    const tiles = lastCompletedRow.querySelectorAll('.Tile-module_tile__UWEHN');
    let pattern = '';
    
    tiles.forEach((tile) => {
      const state = tile.getAttribute('data-state');
      if (state === 'correct') {
        pattern += 'C';
      } else if (state === 'present') {
        pattern += 'M';
      } else if (state === 'absent') {
        pattern += 'A';
      } else {
        pattern += '?';
      }
    });
    
    return {
      success: true,
      pattern: pattern,
      message: `Pattern extracted: ${pattern}`
    };
  }
  
  // Fallback to old format
  const gameRows = document.querySelector('.game_rows');
  if (!gameRows) {
    return {
      success: false,
      message: 'Game board not found'
    };
  }

  const completedRows = gameRows.querySelectorAll('.Row-locked-in');
  if (completedRows.length === 0) {
    return {
      success: false,
      message: 'No completed rows found'
    };
  }

  // Get the last completed row
  const lastRow = completedRows[completedRows.length - 1];
  const letters = lastRow.querySelectorAll('.Row-letter');
  
  let pattern = '';
  
  letters.forEach((letterElement) => {
    if (letterElement.classList.contains('letter-correct')) {
      pattern += 'C';
    } else if (letterElement.classList.contains('letter-elsewhere')) {
      pattern += 'M';
    } else if (letterElement.classList.contains('letter-absent')) {
      pattern += 'A';
    } else {
      pattern += '?'; // Unknown state
    }
  });

  return {
    success: true,
    pattern: pattern,
    message: `Pattern extracted: ${pattern}`
  };
}

function checkForInvalidWord() {
  // Try new format first
  const newBoard = document.querySelector('.Board-module_board__jeoPS');
  if (newBoard) {
    const rows = newBoard.querySelectorAll('.Row-module_row__pwpBq');
    
    for (let row of rows) {
      const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');
      const hasContent = Array.from(tiles).some(tile => 
        tile.textContent.trim() !== '' && 
        tile.getAttribute('data-state') !== 'empty' &&
        tile.getAttribute('data-state') !== 'correct' &&
        tile.getAttribute('data-state') !== 'present' &&
        tile.getAttribute('data-state') !== 'absent'
      );
      
      // Check if row has content but tiles are in an invalid state
      if (hasContent) {
        const word = Array.from(tiles)
          .map(tile => tile.textContent.trim().toLowerCase())
          .join('');
        
        return {
          success: true,
          isInvalid: true,
          invalidWord: word,
          message: `Invalid word detected: ${word}`
        };
      }
    }
    
    return {
      success: true,
      isInvalid: false,
      message: 'No invalid word detected'
    };
  }
  
  // Fallback to old format
  const gameRows = document.querySelector('.game_rows');
  if (!gameRows) {
    return {
      success: false,
      message: 'Game board not found'
    };
  }

  // Look for rows that have letters but are not locked in (invalid words)
  const allRows = gameRows.querySelectorAll('.Row');
  
  for (let row of allRows) {
    const letters = row.querySelectorAll('.Row-letter');
    const hasContent = Array.from(letters).some(letter => 
      letter.textContent.trim() !== '' && 
      letter.classList.contains('selected')
    );
    
    if (hasContent && !row.classList.contains('Row-locked-in')) {
      // This row has content but is not locked in - likely an invalid word
      const word = Array.from(letters)
        .map(letter => letter.textContent.trim().toLowerCase())
        .join('');
      
      return {
        success: true,
        isInvalid: true,
        invalidWord: word,
        message: `Invalid word detected: ${word}`
      };
    }
  }

  return {
    success: true,
    isInvalid: false,
    message: 'No invalid word detected'
  };
}

function getAllCompletedRows() {
  // Try new format first
  const newBoard = document.querySelector('.Board-module_board__jeoPS');
  if (newBoard) {
    const rows = newBoard.querySelectorAll('.Row-module_row__pwpBq');
    const completedRows = [];

    rows.forEach(row => {
      const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');
      const hasContent = Array.from(tiles).every(tile => 
        tile.getAttribute('data-state') !== 'empty'
      );
      
      if (hasContent) {
        let word = '';
        let pattern = '';
        
        tiles.forEach((tile) => {
          const letter = tile.textContent.trim().toLowerCase();
          word += letter;
          
          const state = tile.getAttribute('data-state');
          if (state === 'correct') {
            pattern += 'C';
          } else if (state === 'present') {
            pattern += 'M';
          } else if (state === 'absent') {
            pattern += 'A';
          } else {
            pattern += '?';
          }
        });
        
        if (word.length === 5) {
          completedRows.push({
            word: word,
            pattern: pattern
          });
        }
      }
    });

    return {
      success: true,
      rows: completedRows,
      message: `Found ${completedRows.length} completed rows`
    };
  }
  
  // Fallback to old format
  const gameRows = document.querySelector('.game_rows');
  if (!gameRows) {
    return {
      success: false,
      message: 'Game board not found'
    };
  }

  const completedRows = gameRows.querySelectorAll('.Row-locked-in');
  const rows = [];

  completedRows.forEach(row => {
    const letters = row.querySelectorAll('.Row-letter');
    let word = '';
    let pattern = '';
    
    letters.forEach((letterElement) => {
      const letter = letterElement.textContent.trim().toLowerCase();
      word += letter;
      
      if (letterElement.classList.contains('letter-correct')) {
        pattern += 'C';
      } else if (letterElement.classList.contains('letter-elsewhere')) {
        pattern += 'M';
      } else if (letterElement.classList.contains('letter-absent')) {
        pattern += 'A';
      } else {
        pattern += '?';
      }
    });
    
    if (word.length === 5) {
      rows.push({
        word: word,
        pattern: pattern
      });
    }
  });

  return {
    success: true,
    rows: rows,
    message: `Found ${rows.length} completed rows`
  };
}

function analyzeGameState() {
  // Try new format first
  const newBoard = document.querySelector('.Board-module_board__jeoPS');
  if (newBoard) {
    const rows = newBoard.querySelectorAll('.Row-module_row__pwpBq');
    const completedRows = [];
    
    rows.forEach(row => {
      const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');
      const hasContent = Array.from(tiles).every(tile => 
        tile.getAttribute('data-state') !== 'empty'
      );
      
      if (hasContent) {
        completedRows.push(row);
      }
    });
    
    if (completedRows.length === 0) {
      return {
        success: false,
        message: 'No completed rows found'
      };
    }

    let correctLetters = {};
    let misplacedLetters = {};
    let absentLetters = [];

    completedRows.forEach(row => {
      const tiles = row.querySelectorAll('.Tile-module_tile__UWEHN');
      
      tiles.forEach((tile, position) => {
        const letter = tile.textContent.trim().toLowerCase();
        const state = tile.getAttribute('data-state');
        
        if (state === 'correct') {
          correctLetters[position] = letter;
        } else if (state === 'present') {
          if (!misplacedLetters[letter]) {
            misplacedLetters[letter] = [];
          }
          misplacedLetters[letter].push(position);
        } else if (state === 'absent') {
          if (!absentLetters.includes(letter)) {
            absentLetters.push(letter);
          }
        }
      });
    });

    // Remove misplaced letters from absent letters if they appear as misplaced
    Object.keys(misplacedLetters).forEach(letter => {
      const index = absentLetters.indexOf(letter);
      if (index > -1) {
        absentLetters.splice(index, 1);
      }
    });

    // Remove correct letters from absent letters
    Object.values(correctLetters).forEach(letter => {
      const index = absentLetters.indexOf(letter);
      if (index > -1) {
        absentLetters.splice(index, 1);
      }
    });

    return {
      success: true,
      correctLetters,
      misplacedLetters,
      absentLetters,
      message: `Analyzed ${completedRows.length} completed rows`
    };
  }
  
  // Fallback to old format
  const gameRows = document.querySelector('.game_rows');
  if (!gameRows) {
    return {
      success: false,
      message: 'Game board not found'
    };
  }

  const completedRows = gameRows.querySelectorAll('.Row-locked-in');
  if (completedRows.length === 0) {
    return {
      success: false,
      message: 'No completed rows found'
    };
  }

  let correctLetters = {};
  let misplacedLetters = {};
  let absentLetters = [];

  completedRows.forEach(row => {
    const letters = row.querySelectorAll('.Row-letter');
    
    letters.forEach((letterElement, position) => {
      const letter = letterElement.textContent.trim().toLowerCase();
      
      if (letterElement.classList.contains('letter-correct')) {
        correctLetters[position] = letter;
      } else if (letterElement.classList.contains('letter-elsewhere')) {
        if (!misplacedLetters[letter]) {
          misplacedLetters[letter] = [];
        }
        misplacedLetters[letter].push(position);
      } else if (letterElement.classList.contains('letter-absent')) {
        if (!absentLetters.includes(letter)) {
          absentLetters.push(letter);
        }
      }
    });
  });

  // Remove misplaced letters from absent letters if they appear as misplaced
  Object.keys(misplacedLetters).forEach(letter => {
    const index = absentLetters.indexOf(letter);
    if (index > -1) {
      absentLetters.splice(index, 1);
    }
  });

  // Remove correct letters from absent letters
  Object.values(correctLetters).forEach(letter => {
    const index = absentLetters.indexOf(letter);
    if (index > -1) {
      absentLetters.splice(index, 1);
    }
  });

  return {
    success: true,
    correctLetters,
    misplacedLetters,
    absentLetters,
    message: `Analyzed ${completedRows.length} completed rows`
  };
}

// Prevent multiple listeners by checking if already registered
if (!window.wordleListenerRegistered) {
  window.wordleListenerRegistered = true;
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    switch (request.action) {
      case 'typeWord':
        // Check for new format keyboard first
        let keyboard = document.querySelector('.Keyboard-module_keyboard__uYuqf');
        if (!keyboard) {
          // Fallback to old format
          keyboard = document.querySelector('.Game-keyboard');
        }
        
        if (!keyboard) {
          sendResponse({
            success: false,
            message: 'No game keyboard found on this page'
          });
          return;
        }
        
        typeWord(request.word, request.delay).then(result => {
          sendResponse(result);
        });
        return true; // Keep message channel open for async response
        
      case 'pressEnter':
        const enterButton = findEnterButton();
        if (clickButton(enterButton)) {
          sendResponse({
            success: true,
            message: 'Enter pressed successfully!'
          });
        } else {
          sendResponse({
            success: false,
            message: 'Enter button not found'
          });
        }
        break;
        
      case 'pressBackspace':
        const backspaceButton = findBackspaceButton();
        if (clickButton(backspaceButton)) {
          sendResponse({
            success: true,
            message: 'Backspace pressed successfully!'
          });
        } else {
          sendResponse({
            success: false,
            message: 'Backspace button not found'
          });
        }
        break;

      case 'analyzeGame':
        const analysis = analyzeGameState();
        sendResponse(analysis);
        break;

      case 'getLastRowPattern':
        const patternResult = getLastRowPattern();
        sendResponse(patternResult);
        break;

      case 'checkForInvalidWord':
        const invalidWordResult = checkForInvalidWord();
        sendResponse(invalidWordResult);
        break;

      case 'getAllCompletedRows':
        const allRowsResult = getAllCompletedRows();
        sendResponse(allRowsResult);
        break;
        
      default:
        sendResponse({
          success: false,
          message: 'Unknown action'
        });
    }
  });
}
