const request = require('request');
const fs = require('fs');
const path = require('path');
const jsdom = require("jsdom");
const syncLoop = require('sync-loop');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { JSDOM } = jsdom;
const moment = require('moment');
const constants = require('./config');
const format = require('string-format')

let prefix = constants.prefix;
let domain = constants.domain;
let filename = path.join(__dirname, `Domains_${prefix}_${moment().format(constants.formatNameCsv)}.csv`);
let godDaddyKey = constants.godDaddyKey;
let godDaddySecret = constants.godDaddySecret;
let wordsWithError = [];
let csvFile = {};

const start = () => {
    numOfPages()
        .then(pLetters => {
            syncLoop(pLetters.length, (loop) => {
                let index = loop.iteration();
                let pages = pLetters[index];
                wordsForLetter(pages.letter, pages.pages)
                    .then(words => {
                        syncLoop(words.length, (l) => {
                            let i = l.iteration();
                            let word = words[i];
                            log(`${i} - check word "${word}"`);
                            let request = format(constants.apiUrl,prefix, cleanWord(word), domain);
                            http(request).then(dataResponse => {
                                let data = JSON.parse(dataResponse);
                                let Records = []
                                Records.push({
                                    domain: data.domain,
                                    available: data.available,
                                    dateCreation: moment().format('DD MM YYYY h:mm:ss a')
                                });
                                createCSVFile(Records).then(() => {
                                    log(`word "${word}" checked`);
                                    log('--------------------')
                                    l.next()
                                });
                            }).catch(error => {
                                log(error);
                                wordsWithError.push({
                                    position: i,
                                    word: words[i],
                                    dateTime: moment()
                                });
                                l.next();
                            });
                        }, () => {
                            //finish loop
                            if (wordsWithError.length > 0) {
                                //ToDo: start to get the exception words 
                            }
                            loop.next();
                        });

                    });
            }, () => {
                //finish loop
                log("finish !!!");
            });
        })
        .catch(error => {
            log(error);
        })
}
const getAbc = () => {
    let firstLetter = 'a';
    let endLetter = 'z';
    let a = [], i = firstLetter.charCodeAt(0), j = endLetter.charCodeAt(0);
    for (; i <= j; i++) {
        a.push(String.fromCharCode(i));
    }
    return a;
}
const numOfPages = () => {
    return new Promise((resolve, reject) => {
        try {
            let abc = getAbc();
            let objArrayResponse = [];
            syncLoop(abc.length, (loop) => {
                let index = loop.iteration();
                let letter = abc[index];
                JSDOM.fromURL(`https://www.dictionary.com/list/${letter}/`)
                    .then(response => {
                        let numNewIMplemenation = response.window.document.getElementsByClassName('css-7cjcxa-NavLastItem')[0].children[0].dataset.page
                        // let numPages = parseInt(response
                        //     .window
                        //     .document
                        //     .getElementsByClassName('css-d19rru')[1]
                        //     .innerHTML
                        //     .replace(/\s/g, '')
                        //     .split('"')[1]);
                        let numPages = parseInt(numNewIMplemenation);
                        objArrayResponse.push({ letter: letter, pages: numPages });
                        loop.next();
                    });
            }, () => {
                resolve(objArrayResponse);
            });
        } catch (error) {
            reject(error);
        }
    });
}
const wordsForLetter = (letter, pages) => {
    return new Promise((resolve, reject) => {
        let objArrayResponse = [];
        syncLoop(pages, (loop) => {
            let index = loop.iteration();
            JSDOM.fromURL(`https://www.dictionary.com/list/${letter}/${index}`)
                .then(response => {
                    let words = response.window.document.getElementsByClassName('css-1c7x6hk-Anchor');
                    for (const word of words) {
                        if (!word.text.includes('synonyms')) {
                            objArrayResponse.push(word.text);
                        }
                    }
                    loop.next();
                });
        }, () => {
            resolve(objArrayResponse);
        });
    });
}
const http = (url) => {
    return new Promise((resolve, reject) => {
        let secondsToWait = getRandomArbitrary(1, 10) * 1000;
        log(`seconds to wait request: ${secondsToWait / 1000}`);
        setTimeout(() => {
            request({
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `sso-key ${godDaddyKey}:${godDaddySecret}`
                },
                uri: url,
                method: 'GET'
            }, (err, res, body) => {
                if (!err && res.statusCode == 200) {
                    resolve(body);
                } else {
                    reject({ error: err, response: res, body: body });
                }
            });
        }, secondsToWait)
    });
}
const cleanWord = (word) => {
    word = word.replace(/[^a-zA-Z0-9-]/g, '');
    word = word.replace(/-/g, '');
    word = word.replace(/\s/g, '');
    return word;
}
const log = (entry) => {
    console.log(entry);
    let dateTime = `[${moment()}]`;
    entry = `${dateTime} - ${entry} \r\n`;
    fs.appendFileSync(path.join(__dirname, `log_${moment().format('DD_MM_YYYY')}.log`), entry, function (err) {
        if (err) throw err;
    });
}
const createCSVFile = (records) => {
    return new Promise((resolve, reject) => {
        fs.exists(filename, (exists) => {
            if (!exists) {
                csvFile = createCsvWriter({
                    path: filename,
                    header: [
                        { id: 'domain', title: 'Domain' },
                        { id: 'available', title: 'Available' },
                        { id: 'dateCreation', title: 'Check Date' }
                    ]
                });
                csvFile.writeRecords(records)
                    .then(res => {
                        resolve();
                    });
            } else {
                csvFile.writeRecords(records)
                    .then(() => {
                        resolve();
                    }).catch(err => {
                        reject();
                    })
            }
        });
    });


}
const getRandomArbitrary = (min, max) => {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**init script */
start();


