const fs = require('fs');
const m3u8Url = process.argv[2];
const exec = require('child_process').exec;
const rimraf = require('rimraf');
const downloader = require('./downloader');
const spawn = require('child_process').spawn;

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
