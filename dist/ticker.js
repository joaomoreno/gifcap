self.onmessage = e => setInterval(() => postMessage(null), e.data)