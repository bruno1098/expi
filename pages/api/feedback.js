import fs from 'fs';
import path from 'path';

export default function handler(req, res) {
  const feedbackFilePath = path.join(process.cwd(), 'data', 'feedback.json');

  if (req.method === 'POST') {
    // Certifique-se de que a pasta 'data' existe
    if (!fs.existsSync(path.dirname(feedbackFilePath))) {
      fs.mkdirSync(path.dirname(feedbackFilePath), { recursive: true });
    }

    // Lendo feedbacks existentes (se houver)
    let feedbacks = [];
    if (fs.existsSync(feedbackFilePath)) {
      const fileContents = fs.readFileSync(feedbackFilePath);
      feedbacks = JSON.parse(fileContents);
    }

    // Adicionando o novo feedback ao array
    const newFeedback = req.body;
    feedbacks.push(newFeedback);

    // Salvando o feedback no arquivo
    fs.writeFileSync(feedbackFilePath, JSON.stringify(feedbacks, null, 2));

    // Respondendo com sucesso
    res.status(200).json({ message: 'Feedback salvo com sucesso!' });

  } else if (req.method === 'GET') {
    // Se for uma requisição GET, retornamos todos os feedbacks
    if (fs.existsSync(feedbackFilePath)) {
      const fileContents = fs.readFileSync(feedbackFilePath);
      const feedbacks = JSON.parse(fileContents);
      res.status(200).json(feedbacks);
    } else {
      res.status(200).json([]); // Retorna um array vazio se não houver feedbacks
    }
  } else if (req.method === 'DELETE') {
    // Se for uma requisição DELETE, deletamos o arquivo de feedbacks
    if (fs.existsSync(feedbackFilePath)) {
      fs.unlinkSync(feedbackFilePath);  // Deleta o arquivo
      res.status(200).json({ message: 'Arquivo de feedback deletado com sucesso!' });
    } else {
      res.status(404).json({ message: 'Arquivo não encontrado.' });
    }
  } else {
    // Se o método não for POST, GET ou DELETE, retornamos 405 (Método não permitido)
    res.status(405).json({ message: 'Método não permitido' });
  }
}
