const path = require('path');
const fetch = require('node-fetch');
const fs = require('fs');
const m3u8Parser = require('m3u8-parser');

function fetchAndSaveTo (url, id) {
  return fetch(url)
    .then((res) => {
      const fileName = `${id}.m3u8`;
      const dest = fs.createWriteStream(fileName);
      res.body.pipe(dest);
      return new Promise((resolve) => {
        dest.on('finish', () => {
          resolve(fileName);
        });
      });
    })
}

async function downloader (m3u8Url, jumpto) {
  const videoId = /.*\/(.*).(m3u|mp4).*/.exec(m3u8Url)[1];
  const rootPath = m3u8Url.split(videoId)[0];
  console.log(rootPath, videoId)
  const targetManifest = await fetchAndSaveTo(m3u8Url, videoId);
  console.log(targetManifest)
  const contents = fs.readFileSync(targetManifest, 'utf8');

  const parser = new m3u8Parser.Parser();
  parser.push(contents);
  parser.end();
  const parsedManifest = parser.manifest;
  console.log(parsedManifest.segments);

  const keyUri = parsedManifest.segments[0].key
    ? parsedManifest.segments[0].key.uri
    : null;

  const dir = `./${videoId}`;

  if (!fs.existsSync(dir)){
    fs.mkdirSync(dir);
  }

  // replace and save to for ffmpeg
  const tsReg = new RegExp(`${videoId}\\/`, 'g');
  let replaced = contents.replace(tsReg, `${__dirname}/${videoId}/`);

  if (keyUri) {
    console.log(keyUri)
    // download key
    fetch(`${rootPath}${keyUri}`).then((res) => {
      // fs.writeFileSync(keyUri, JSON.res);
      const dest = fs.createWriteStream(`${videoId}/${keyUri}`);
      res.body.pipe(dest);
    });

    // replace key url
    const keyReg = new RegExp(keyUri, 'g');
    replaced = replaced.replace(keyReg, `${__dirname}/${videoId}/${keyUri}`);
  }
  fs.writeFileSync(`${videoId}/forffmpeg.m3u`, replaced);

  // download ts
  const segments = parsedManifest.segments;
  let currentIndex = jumpto > 0 ? jumpto -1 : -1;

  function doFetch () {
    if (currentIndex < segments.length -1) {
      currentIndex += 1;
    } else {
      console.log('fetch segments ended');
      return Promise.resolve({ 
        videoId,
        targetManifest,
      });
    }
    const uri = `${rootPath}${segments[currentIndex].uri}`;
    const writePath = `${videoId}/${segments[currentIndex].uri.replace(tsReg, '')}`;
    console.log(writePath)
    console.log(`downloading #${currentIndex}/${segments.length} ${uri} ...`);
    return fetch(uri)
      .then((res) => {
        const dest = fs.createWriteStream(writePath);
        res.body.pipe(dest);
        fs.appendFileSync(`${videoId}/successed.log`, `${uri}\n`, 'utf8');
        return doFetch();
      })
      .catch((err) => {
        console.log(err);
        fs.appendFileSync(`${videoId}/errored.log`, `${uri}\n`, 'utf8');
        return doFetch();
      });
  }

  return doFetch();
}

module.exports = downloader;
