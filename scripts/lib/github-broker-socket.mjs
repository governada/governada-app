export function attachBrokerSocketErrorHandler(socket) {
  socket.on('error', () => {
    // Clients can time out or disconnect while the broker is still waiting on GitHub.
  });
}

export function sendBrokerSocketResponse({ onSettled = () => {}, response, socket }) {
  let settled = false;
  const settle = () => {
    if (settled) {
      return;
    }
    settled = true;
    socket.off('error', settle);
    onSettled();
  };

  socket.once('error', settle);
  if (socket.destroyed) {
    settle();
    return;
  }

  try {
    socket.end(`${JSON.stringify(response)}\n`, settle);
  } catch {
    settle();
  }
}
