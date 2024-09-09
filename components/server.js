const WebSocket = require('ws');

// Heroku define a porta dinamicamente
const PORT = process.env.PORT || 8080;

// Cria o servidor WebSocket na porta fornecida pelo Heroku ou usa a 8080 localmente
const wss = new WebSocket.Server({ port: PORT });

wss.on('connection', (ws) => {
  console.log('Cliente conectado');

  ws.on('message', (message) => {
    console.log(`Mensagem recebida: ${message}`);
    // Quando receber uma mensagem de um cliente, enviar para todos os outros clientes conectados
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  });

  ws.on('close', () => {
    console.log('Cliente desconectado');
  });
});

console.log(`Servidor WebSocket rodando na porta ${PORT}`);
