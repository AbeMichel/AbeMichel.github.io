const fs = require('fs');
const buildTime = new Date().toLocaleString();

fs.readFile('index.html', 'utf8', (err, data) => {
    if (err) throw err;
    
    const updatedDate = data.replace(
        '<span id="build-timestamp">.*</span>',
        '<span id="build-timestamp">${buildTime}</span>'
    );

    fs.writeFile('index.html', updatedDate, 'utf8', (err) => {
        if (err) throw err;
        console.log('Build timestamp updated');
    });
});