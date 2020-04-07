function testSetInterval() {
  return new Promise(c => {
    const result = [];
    let timestamp = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      result.push(now - timestamp);
      timestamp = now;
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      c(result);
    }, 5000);
  });
}

function testSetTimeout() {
  return new Promise(c => {
    const result = [];
    let timeout;
    let timestamp = Date.now();

    const tick = () => {
      const now = Date.now();
      result.push(now - timestamp);
      timestamp = now;

      timeout = setTimeout(tick, 100);
    };

    timeout = setTimeout(tick, 100);

    setTimeout(() => {
      clearTimeout(timeout);
      c(result);
    }, 5000);
  });
}

function testRequestAnimationFrame() {
  return new Promise(c => {
    const result = [];
    let stop = false;
    let timestamp = Date.now();

    const tick = () => {
      const now = Date.now();

      if (stop) {
        return;
      } else if (now - timestamp >= 95) {
        result.push(now - timestamp);
        timestamp = now;
      }

      window.requestAnimationFrame(tick);
    };

    window.requestAnimationFrame(tick);

    setTimeout(() => {
      stop = true;
      c(result);
    }, 5000);
  });
}

function testWorker() {
  return new Promise(c => {
    const worker = new Worker('worker.js');
    const result = [];
    let timestamp = Date.now();

    worker.onmessage = () => {
      const now = Date.now();
      result.push(now - timestamp);
      timestamp = now;
    };

    setTimeout(() => {
      worker.terminate();
      c(result);
    }, 5000);
  });
}

function round(num) {
  return Math.round(num * 100) / 100;
}

function main() {
  const tbody = document.getElementById('tbody');

  function print(name, result) {
    const data = jStat(result);
    const row = document.createElement('tr');
    row.innerHTML = `<th scope="row">${name}</th><td>${round(data.mean())}</td><td>${round(data.stdev())}</td><td>${round(result.length)}</td>`;
    tbody.appendChild(row);
  }

  testSetInterval().then(r => print('interval', r));
  testSetTimeout().then(r => print('timeout', r));
  testRequestAnimationFrame().then(r => print('animation frame', r));
  testWorker().then(r => print('worker', r));
}

main();