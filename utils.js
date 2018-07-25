/**
 * @return {!Promise<?Puppeteer.Frame>}
 */
async function getFrame() {
  const nodeInfo = await this._client.send('DOM.describeNode', {
    objectId: this._remoteObject.objectId
  }).catch(error => void debugError(error));

  if (typeof nodeInfo.node.frameId === 'string') {
    for (const frame of this._page.frames()) {
      if (nodeInfo.node.frameId === frame._id)
        return frame;
    }

    return null;
  } else {
    return null;
  }
}

module.exports = {
  getFrame,
};
