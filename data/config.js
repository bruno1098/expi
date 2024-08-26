const { Pool } = require('pg');

// Configurando a conexão com o banco de dados
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Você vai definir essa variável de ambiente no Vercel
  ssl: {
    rejectUnauthorized: false
  }
});

// Função para salvar o feedback no banco de dados
async function saveFeedback(feedbackData) {
  const { id, usuario, comentario, rating, data } = feedbackData;

  const query = `
    INSERT INTO feedback (id, usuario, comentario, rating, data)
    VALUES ($1, $2, $3, $4, $5)
  `;

  const values = [id, usuario, comentario, rating, data];

  try {
    const res = await pool.query(query, values);
    console.log('Feedback salvo com sucesso:', res);
  } catch (err) {
    console.error('Erro ao salvar o feedback:', err);
  }
}

module.exports = saveFeedback;
