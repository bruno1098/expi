
import { ref, set } from "firebase/database";
import { database } from "../../pages/api/feedback"; // Ajuste o caminho conforme sua estrutura
import axios from 'axios';

export default async function handler(req, res) {
  if (req.method === 'POST') {
    const { transcription, callSessionId } = req.body;

    if (!transcription || !callSessionId) {
      return res.status(400).json({ error: "Transcrição ou callSessionId não fornecido." });
    }

    try {
      // Chave da API do OpenAI
      const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
      if (!OPENAI_API_KEY) {
        return res.status(500).json({ error: "Chave da API do OpenAI não configurada." });
      }

      // Chamada para o GPT para analisar a transcrição
      const analysisResponse = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "Você é um assistente que analisa conversas de atendimento ao cliente." },
            { role: "user", content: `
              Analise a seguinte conversa de atendimento ao cliente. Identifique quem é o cliente e quem é o atendente com base em palavras-chave.
              Analise o sentimento da conversa e determine se o cliente foi atendido de forma correta, se ficou satisfeito ou insatisfeito, e forneça feedback sobre como melhorar o atendimento.

              Conversa:
              ${transcription}

              Análise:
            ` },
          ],
          max_tokens: 300,
          temperature: 0.7,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
        }
      );

      const analysis = analysisResponse.data.choices[0].message.content.trim();

      // Salvar o feedback no Firebase em /ura/{callSessionId}/feedback
      const uraRef = ref(database, `ura/${callSessionId}/feedback`);
      await set(uraRef, analysis);

      return res.status(200).json({ feedback: analysis });
    } catch (error) {
      console.error("Erro ao analisar a transcrição:", error.response ? error.response.data : error.message);
      return res.status(500).json({ error: "Erro ao analisar a transcrição." });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    return res.status(405).end(`Método ${req.method} não permitido.`);
  }
}
