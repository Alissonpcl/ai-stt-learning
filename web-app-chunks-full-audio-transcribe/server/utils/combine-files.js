// This script combines two audio files into one.
// Usefull to test if the audio files are being correctly generated.

const fs = require('fs');

// Get file paths from command-line arguments
const [, , file1, file2, output] = process.argv;
if (!file1 || !file2 || !output) {
    console.log('Usage: node combine.js <file1> <file2> <output>');
    process.exit(1);
}

try {    
    const finalStream = fs.createWriteStream(output);

    let data = fs.readFileSync(file1);
    finalStream.write(data);

    data = fs.readFileSync(file2);
    finalStream.write(data);

    finalStream.end();

    finalStream.on('finish', () => {
        console.log(`Files combined successfully to ${output}!`);    
    });
} catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
}