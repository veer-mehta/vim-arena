const vim = { lines: [] };
function generateSegment(row, startCol, endCol, towerLine) {
    if (towerLine) vim.lines[row] = towerLine;

    const WORDS = ['function', 'return', 'const', 'let', 'type'];
    function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

    const toGenerate = endCol - startCol;
    if (toGenerate <= 0) return;

    const line = [];
    let len = 0;

    while (len < toGenerate) {
        const word = pick(WORDS);
        if (len + word.length > toGenerate) break;
        if (line.length > 0) { line.push(' '); len++; }
        line.push(word);
        len += word.length;
    }

    if (line.length === 0) {
        return;
    }
    
    const text = line.join('');

    let existingLine = vim.lines[row] || '';
    existingLine = existingLine.padEnd(startCol + text.length, ' ');

    let newLine = existingLine.slice(0, startCol);
    for (let c = 0; c < text.length; c++) {
        const globalCol = startCol + c;
        const protectedCell = false; // simplify
        
        if (existingLine[globalCol] !== ' ' || protectedCell) {
            newLine += existingLine[globalCol] || ' ';
        } else {
            newLine += text[c];
        }
    }

    if (existingLine.length > startCol + text.length) {
        newLine += existingLine.slice(startCol + text.length);
    }

    vim.lines[row] = newLine;
}

let towerStr = ' '.repeat(40) + '====';
generateSegment(0, 0, 100, towerStr);
console.log(vim.lines[0]);
console.log('Length:', vim.lines[0].length);
