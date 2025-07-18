document.addEventListener('DOMContentLoaded', function() {
  const startBtn = document.getElementById('start-btn');
  const analyzeBtn = document.getElementById('analyze-btn');
  const wordFile = document.getElementById('word-file');
  const status = document.getElementById('status');
  const wordChoices = document.getElementById('word-choices');
  const wordGrid = document.getElementById('word-grid');
  const analysisInfo = document.getElementById('analysis-info');
  
  let wordList = [];
  let gameData = { words: [] };
  let currentAttempt = 0;
  let invalidWords = new Set(); // Track invalid words to exclude from suggestions
  let lastKnownRowCount = 0; // Track the number of completed rows

  function updateStatus(message, type = 'info') {
    status.textContent = message;
    status.className = `status ${type}`;
  }

  // Load word list from local output.txt file
  async function loadWordList() {
    try {
      const response = await fetch(chrome.runtime.getURL('output.txt'));
      const text = await response.text();
      wordList = text.split('\n')
        .map(word => word.trim().toLowerCase())
        .filter(word => word.length === 5);
      
      updateStatus(`Loaded ${wordList.length} words from output.txt`, 'success');
      startBtn.disabled = false;
      
      // Initialize by reading current game state
      await readCurrentGameState();
      
      return true;
    } catch (error) {
      updateStatus('Error loading output.txt file', 'error');
      return false;
    }
  }

  // Hide file input since we're using local file
  wordFile.style.display = 'none';
  document.querySelector('.file-input').style.display = 'none';

  // Load word list on startup
  loadWordList();

  function sendMessageToContent(action, data = {}) {
    return new Promise((resolve) => {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: action,
          ...data
        }, function(response) {
          if (chrome.runtime.lastError) {
            resolve({ success: false, message: 'Error: Please refresh the page and try again' });
          } else {
            resolve(response || { success: false, message: 'No response' });
          }
        });
      });
    });
  }

  async function typeAndEnterWord(word) {
    updateStatus(`Typing "${word}"...`, 'info');
    
    const typeResult = await sendMessageToContent('typeWord', {
      word: word,
      delay: 300
    });
    
    if (!typeResult.success) {
      updateStatus(typeResult.message, 'error');
      return false;
    }
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const enterResult = await sendMessageToContent('pressEnter');
    
    if (!enterResult.success) {
      updateStatus(enterResult.message, 'error');
      return false;
    }
    
    return true;
  }

  async function readCurrentGameState() {
    try {
      const analysisResult = await sendMessageToContent('analyzeGame');
      if (analysisResult.success) {
        // Convert the analysis result to our gameData format
        gameData.words = [];
        
        // We need to get all completed rows and their patterns
        const allRowsResult = await sendMessageToContent('getAllCompletedRows');
        if (allRowsResult.success && allRowsResult.rows) {
          gameData.words = allRowsResult.rows;
          currentAttempt = allRowsResult.rows.length;
          lastKnownRowCount = allRowsResult.rows.length;
          
          if (currentAttempt > 0) {
            updateStatus(`Found ${currentAttempt} existing attempts. Ready to analyze!`, 'info');
            analyzeBtn.disabled = false;
          }
        }
      }
    } catch (error) {
      console.log('Could not read current game state:', error);
    }
  }

  async function checkForNewRows() {
    try {
      const allRowsResult = await sendMessageToContent('getAllCompletedRows');
      if (allRowsResult.success && allRowsResult.rows) {
        const newRowCount = allRowsResult.rows.length;
        
        if (newRowCount > lastKnownRowCount) {
          // New rows detected, update our data
          gameData.words = allRowsResult.rows;
          const previousAttempt = currentAttempt;
          currentAttempt = newRowCount;
          lastKnownRowCount = newRowCount;
          
          const newEntries = newRowCount - previousAttempt;
          updateStatus(`Detected ${newEntries} new manual entries. Ready to analyze!`, 'info');
          analyzeBtn.disabled = false;
          
          // Check if game is solved
          const lastRow = allRowsResult.rows[allRowsResult.rows.length - 1];
          if (lastRow && lastRow.pattern === "CCCCC") {
            updateStatus(`🎉 SOLVED! The word was "${lastRow.word}"!`, 'success');
            return true;
          }
        }
      }
    } catch (error) {
      console.log('Could not check for new rows:', error);
    }
    return false;
  }

  function analyzeWords() {
    // Python logic implementation
    let misplacedLetters = [];
    let correctLetters = {};
    let potentialAbsentLetters = {};
    let testedPositions = {};
    let testedLetters = new Set();

    // Parse words
    for (let entry of gameData.words) {
      const word = entry.word;
      const pattern = entry.pattern;

      for (let i = 0; i < word.length; i++) {
        const ch = word[i];
        const p = pattern[i];
        
        testedLetters.add(ch);
        
        if (!testedPositions[ch]) {
          testedPositions[ch] = new Set();
        }
        testedPositions[ch].add(i);
        
        if (!potentialAbsentLetters[ch]) {
          potentialAbsentLetters[ch] = new Set();
        }
        potentialAbsentLetters[ch].add(p);

        if (p === "C") {
          correctLetters[i] = ch;
        } else if (p === "M") {
          misplacedLetters.push([ch, i]);
        }
      }
    }

    // Finalize absent letters
    let absentLetters = new Set();
    for (let ch in potentialAbsentLetters) {
      const types = potentialAbsentLetters[ch];
      if (types.size === 1 && types.has("A")) {
        absentLetters.add(ch);
      }
    }

    // Untested letters
    const allLetters = new Set("abcdefghijklmnopqrstuvwxyz");
    const untestedLetters = [...allLetters].filter(x => !testedLetters.has(x)).sort();

    // Find matches
    const matches = [];
    
    for (let word of wordList) {
      word = word.toLowerCase();
      
      // Skip invalid words
      if (invalidWords.has(word)) {
        continue;
      }
      
      let valid = true;

      // Skip if contains any fully absent letter
      if ([...absentLetters].some(ch => word.includes(ch))) {
        continue;
      }

      // Enforce correct positions
      for (let idx in correctLetters) {
        if (word[idx] !== correctLetters[idx]) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      // Misplaced logic: must appear, not at original position
      for (let [ch, idx] of misplacedLetters) {
        if (!word.includes(ch)) {
          valid = false;
          break;
        }
        if (word[idx] === ch) {
          valid = false;
          break;
        }
      }
      if (!valid) continue;

      matches.push(word);
    }

    return {
      correctLetters,
      misplacedLetters,
      absentLetters: [...absentLetters].sort(),
      untestedLetters,
      matches: matches.sort()
    };
  }

  function findEliminatorWords(analysis) {
    const { untestedLetters, absentLetters, correctLetters, misplacedLetters, matches } = analysis;
    
    if (matches.length <= 1) {
      return [];
    }

    const eliminatorWords = [];
    
    // Find letters that differ between possible answers
    const differingLetters = new Set();
    
    // Compare all possible answers to find positions where they differ
    for (let pos = 0; pos < 5; pos++) {
      const lettersAtPosition = new Set();
      matches.forEach(word => {
        lettersAtPosition.add(word[pos]);
      });
      
      // If more than one letter appears at this position, these letters help distinguish
      if (lettersAtPosition.size > 1) {
        lettersAtPosition.forEach(letter => differingLetters.add(letter));
      }
    }
    
    // Remove letters we already know are correct or misplaced from differing letters
    Object.values(correctLetters).forEach(letter => differingLetters.delete(letter));
    misplacedLetters.forEach(([letter, pos]) => differingLetters.delete(letter));
    
    console.log('Differing letters between candidates:', [...differingLetters]);
    console.log('Untested letters:', untestedLetters);
    
    // Priority 1: Words that test multiple differing letters
    // Priority 2: Words that test differing letters + untested letters
    // Priority 3: Words that test just untested letters
    
    for (let word of wordList) {
      word = word.toLowerCase();
      
      // Skip invalid words
      if (invalidWords.has(word)) {
        continue;
      }
      
      // Skip if word contains any absent letters
      if (absentLetters.some(letter => word.includes(letter))) {
        continue;
      }
      
      // Skip words that are already possible answers
      if (matches.includes(word)) {
        continue;
      }
      
      // Check conflicts with correct positions
      let conflictsWithCorrect = false;
      for (let pos in correctLetters) {
        if (word[pos] !== correctLetters[pos]) {
          conflictsWithCorrect = true;
          break;
        }
      }
      if (conflictsWithCorrect) continue;
      
      // Check conflicts with misplaced letters (shouldn't place them in wrong positions)
      let conflictsWithMisplaced = false;
      for (let [letter, pos] of misplacedLetters) {
        if (word[pos] === letter) {
          conflictsWithMisplaced = true;
          break;
        }
      }
      if (conflictsWithMisplaced) continue;
      
      // Count differing letters and untested letters in this word
      const differingInWord = word.split('').filter(letter => differingLetters.has(letter));
      const untestedInWord = word.split('').filter(letter => untestedLetters.includes(letter));
      const uniqueDiffering = [...new Set(differingInWord)];
      const uniqueUntested = [...new Set(untestedInWord)];
      
      // Calculate priority score
      let score = 0;
      let category = '';
      let testedLetters = [];
      
      if (uniqueDiffering.length >= 2) {
        // Best: tests multiple differing letters
        score = 1000 + uniqueDiffering.length * 100 + uniqueUntested.length * 10;
        category = `${uniqueDiffering.length} differing`;
        testedLetters = uniqueDiffering;
        if (uniqueUntested.length > 0) {
          category += ` + ${uniqueUntested.length} untested`;
          testedLetters = [...testedLetters, ...uniqueUntested];
        }
      } else if (uniqueDiffering.length === 1 && uniqueUntested.length >= 1) {
        // Good: tests 1 differing + untested letters
        score = 500 + uniqueUntested.length * 50;
        category = `1 differing + ${uniqueUntested.length} untested`;
        testedLetters = [...uniqueDiffering, ...uniqueUntested];
      } else if (uniqueDiffering.length === 1) {
        // Okay: tests 1 differing letter
        score = 300;
        category = '1 differing';
        testedLetters = uniqueDiffering;
      } else if (uniqueUntested.length >= 2) {
        // Fallback: tests multiple untested letters
        score = 100 + uniqueUntested.length * 10;
        category = `${uniqueUntested.length} untested`;
        testedLetters = uniqueUntested;
      }
      
      // Only include words that test at least one useful letter
      if (score > 0) {
        eliminatorWords.push({
          word: word,
          score: score,
          category: category,
          untestedCount: uniqueUntested.length,
          differingCount: uniqueDiffering.length,
          untestedLetters: uniqueUntested,
          differingLetters: uniqueDiffering,
          testedLetters: [...new Set(testedLetters)]
        });
      }
    }
    
    // Sort by score (descending) and then alphabetically
    eliminatorWords.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.word.localeCompare(b.word);
    });
    
    console.log('Top eliminator words:', eliminatorWords.slice(0, 5));
    
    // Return top 15 eliminator words
    return eliminatorWords.slice(0, 15);
  }

  function displayAnalysis(analysis) {
    // Show analysis info
    analysisInfo.style.display = 'block';
    
    const correctStr = Object.entries(analysis.correctLetters)
      .map(([pos, letter]) => `${letter}@${pos}`)
      .join(', ') || 'None';
    
    const misplacedStr = analysis.misplacedLetters
      .map(([letter, pos]) => `${letter}!${pos}`)
      .join(', ') || 'None';
    
    document.getElementById('correct-letters').textContent = correctStr;
    document.getElementById('misplaced-letters').textContent = misplacedStr;
    document.getElementById('absent-letters').textContent = analysis.absentLetters.join(', ') || 'None';
    document.getElementById('untested-letters').textContent = analysis.untestedLetters.join(', ') || 'None';
    
    // Show word choices
    wordChoices.style.display = 'block';
    wordGrid.innerHTML = '';
    
    // Add section header for answer words
    if (analysis.matches.length > 0) {
      const answerHeader = document.createElement('div');
      answerHeader.innerHTML = '<strong>🎯 Possible Answers:</strong>';
      answerHeader.style.gridColumn = '1 / -1';
      answerHeader.style.textAlign = 'center';
      answerHeader.style.margin = '10px 0 5px 0';
      answerHeader.style.fontSize = '14px';
      wordGrid.appendChild(answerHeader);
      
      analysis.matches.forEach(word => {
        const button = document.createElement('button');
        button.textContent = word;
        button.className = 'word-button';
        button.style.background = 'rgba(76, 175, 80, 0.3)'; // Green tint for answers
        button.onclick = () => selectWord(word);
        wordGrid.appendChild(button);
      });
    }
    
    // Add eliminator words if we have multiple possible answers OR if we have few/no answers
    if (analysis.matches.length > 1 || (analysis.matches.length <= 2 && analysis.untestedLetters.length > 0)) {
      const eliminatorWords = findEliminatorWords(analysis);
      
      console.log('Eliminator search:', {
        untestedLetters: analysis.untestedLetters,
        eliminatorWords: eliminatorWords.length,
        matches: analysis.matches.length
      });
      
      if (eliminatorWords.length > 0) {
        const eliminatorHeader = document.createElement('div');
        eliminatorHeader.innerHTML = '<strong>🔍 Eliminator Words:</strong>';
        eliminatorHeader.style.gridColumn = '1 / -1';
        eliminatorHeader.style.textAlign = 'center';
        eliminatorHeader.style.margin = '15px 0 5px 0';
        eliminatorHeader.style.fontSize = '14px';
        wordGrid.appendChild(eliminatorHeader);
        
        eliminatorWords.forEach(({ word, category, testedLetters }) => {
          const button = document.createElement('button');
          button.textContent = word;
          button.title = `${category}: ${testedLetters.join(', ')}`;
          button.className = 'word-button';
          button.style.background = 'rgba(255, 193, 7, 0.3)'; // Yellow tint for eliminators
          button.onclick = () => selectWord(word);
          wordGrid.appendChild(button);
        });
      }
    }
    
    let statusMessage = '';
    if (analysis.matches.length > 0) {
      statusMessage = `Found ${analysis.matches.length} possible answer(s)`;
      if (analysis.matches.length > 1) {
        const eliminatorWords = findEliminatorWords(analysis);
        statusMessage += ` and ${eliminatorWords.length} eliminator word(s)`;
      }
      statusMessage += '. Choose one!';
      updateStatus(statusMessage, 'success');
    } else {
      updateStatus('No matching words found!', 'error');
    }
  }

  async function selectWord(word) {
    wordChoices.style.display = 'none';
    
    const success = await typeAndEnterWord(word);
    if (!success) return;
    
    updateStatus(`Word "${word}" submitted. Checking validity...`, 'info');
    
    // Wait a bit for the game to process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Check if the word was invalid
    const invalidCheck = await sendMessageToContent('checkForInvalidWord');
    if (invalidCheck.success && invalidCheck.isInvalid) {
      // Word was invalid, add to invalid list and show suggestions again
      // DON'T increment currentAttempt since invalid words don't count as attempts
      invalidWords.add(word.toLowerCase());
      updateStatus(`"${word}" is not a valid word. Removed from suggestions. Choose another word.`, 'error');
      
      // Re-analyze and show updated suggestions
      const analysis = analyzeWords();
      displayAnalysis(analysis);
      return;
    }
    
    // Word was valid, NOW increment the attempt counter
    currentAttempt++;
    updateStatus(`Word "${word}" accepted. Waiting for results...`, 'info');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get pattern from game board
    const analysisResult = await sendMessageToContent('getLastRowPattern');
    if (!analysisResult.success) {
      updateStatus(analysisResult.message, 'error');
      return;
    }
    
    // Add to game data
    gameData.words.push({
      word: word,
      pattern: analysisResult.pattern
    });
    
    if (analysisResult.pattern === "CCCCC") {
      updateStatus(`🎉 SOLVED! The word was "${word}"!`, 'success');
      return;
    }
    
    if (currentAttempt >= 6) {
      updateStatus('Game over! No more attempts.', 'error');
      return;
    }
    
    updateStatus(`Attempt ${currentAttempt}/6 complete. Ready to analyze!`, 'info');
    analyzeBtn.disabled = false;
  }

  startBtn.addEventListener('click', async function() {
    startBtn.disabled = true;
    invalidWords.clear(); // Reset invalid words for new game
    
    // First check if there are any existing attempts
    await readCurrentGameState();
    
    const defaultWords = ['moist', 'lunch', 'ready'];
    const wordsToType = [];
    
    // Determine which words we need to type based on current attempts
    if (currentAttempt === 0) {
      wordsToType.push(...defaultWords); // Type all 3 words
    } else if (currentAttempt === 1) {
      wordsToType.push('lunch', 'ready'); // Type last 2 words
    } else if (currentAttempt === 2) {
      wordsToType.push('ready'); // Type last word
    } else {
      // User already has 3+ attempts, no need to type our words
      updateStatus(`Found ${currentAttempt} existing attempts. Ready to analyze!`, 'success');
      analyzeBtn.disabled = false;
      startBtn.disabled = false;
      return;
    }
    
    // Type the remaining words
    for (let word of wordsToType) {
      const success = await typeAndEnterWord(word);
      if (!success) {
        startBtn.disabled = false;
        return;
      }
      
      currentAttempt++;
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Get pattern from game board
      const analysisResult = await sendMessageToContent('getLastRowPattern');
      if (!analysisResult.success) {
        updateStatus(analysisResult.message, 'error');
        startBtn.disabled = false;
        return;
      }
      
      gameData.words.push({
        word: word,
        pattern: analysisResult.pattern
      });
      
      if (analysisResult.pattern === "CCCCC") {
        updateStatus(`🎉 SOLVED! The word was "${word}"!`, 'success');
        startBtn.disabled = false;
        return;
      }
    }
    
    // Update the known row count
    lastKnownRowCount = currentAttempt;
    
    updateStatus(`Setup complete with ${currentAttempt} attempts. Ready to analyze!`, 'success');
    analyzeBtn.disabled = false;
    startBtn.disabled = false;
  });

  analyzeBtn.addEventListener('click', async function() {
    analyzeBtn.disabled = true;
    
    // First check for any new manual entries
    const gameWasSolved = await checkForNewRows();
    if (gameWasSolved) {
      analyzeBtn.disabled = false;
      return;
    }
    
    const analysis = analyzeWords();
    displayAnalysis(analysis);
    
    analyzeBtn.disabled = false;
  });

  // Periodically check for manual user input
  setInterval(async () => {
    if (currentAttempt > 0 && currentAttempt < 6) {
      await checkForNewRows();
    }
  }, 3000); // Check every 3 seconds
});