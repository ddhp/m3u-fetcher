const fs = require('fs');
// const m3u8Url = process.argv[2];
const exec = require('child_process').exec;
const puppeteer = require('puppeteer');
const rimraf = require('rimraf');
const downloader = require('./downloader');
const spawn = require('child_process').spawn;
const { getFrame } = require('./utils');

const url = 'https://www.bbc.co.uk/news/av/10318236/headlines-from-bbc-news';

function onStdout (data) {
  console.log(`stdout: ${data}`);
}

function onStderr (data) {
  console.log(`stderr: ${data}`);
}

function onExit (resolve) {
  return (code) => {
    console.log(`child process exited with code ${code}`);
    resolve();
  }
}

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
    timeout: 10000,
    executablePath: '/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome',
  });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(200000);

  await page.goto(url);

  console.log(0);
  const frameElement = await page.$('iframe#smphtml5iframemedia-player-1');
  console.log('1');
  const frame = await getFrame.apply(frameElement);
  console.log('2');
  const buttonDOM = await frame.waitForSelector('#mediaContainer > .p_button.p_cta', {visible: true});
  console.log('3');
  console.log(buttonDOM);
  // await page.setRequestInterception(true);
  await frame.$eval('#mediaContainer > .p_button.p_cta', el => el.click());
  let targetDashUrl;
  await page.waitForRequest(request => {
    console.log(request.url());
    if (request.url().endsWith('.dash')) {
      targetDashUrl = request.url();
      return true;
    }
  });

  console.log(targetDashUrl);
  await browser.close();

  const m3u8Url = targetDashUrl.replace(/\.dash$/, '.m3u8');
  console.log(m3u8Url);

  if (!fs.existsSync('./dist')){
    fs.mkdirSync('./dist');
  }

  const { videoId, targetManifest } = await downloader(m3u8Url);   

  const toFinalTsPromise = new Promise((resolve, reject) => {
    const toFinalTs = spawn('ffmpeg', [ 
      '-y', '-i',
      `${videoId}/forffmpeg.m3u`, '-c', 'copy', `${videoId}/final.ts`
    ]);
    toFinalTs.stdout.on('data', onStdout);
    toFinalTs.stderr.on('data', onStderr);
    toFinalTs.on('close', onExit(resolve));
  });
  await toFinalTsPromise;

  const toResultPromise = new Promise((resolve) => {
    const toResult = spawn('ffmpeg', [
      '-y', '-i', `${videoId}/final.ts`, 
      '-acodec', 'copy', '-vcodec', 'copy', `dist/${videoId}.m4a`
    ]);
    toResult.stdout.on('data', onStdout);
    toResult.stderr.on('data', onStderr);
    toResult.on('close', onExit(resolve));
  });

  await toResultPromise;
  rimraf.sync(targetManifest);
  rimraf.sync(videoId);
  process.exit();
})();
