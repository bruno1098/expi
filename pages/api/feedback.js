import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, child } from "firebase/database";

// Configurações do Firebase com suas credenciais
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export default async function handler(req, res) {
  // Adiciona cabeçalhos de CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    // Responde a requisições OPTIONS rapidamente
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    // Lógica para salvar feedback no Firebase
    const { id, usuario, comentario, rating, data } = req.body;

    try {
      const feedbackRef = ref(database, `feedback/${id}`);
      await set(feedbackRef, {
        id,
        usuario,
        comentario,
        rating,
        data,
      });
      res.status(200).json({ message: 'Feedback salvo com sucesso!' });
    } catch (err) {
      console.error('Erro ao salvar feedback:', err);
      res.status(500).json({ error: 'Erro ao salvar feedback' });
    }
  } else if (req.method === 'GET') {
    // Lógica para recuperar feedback do Firebase
    try {
      const dbRef = ref(database);
      const snapshot = await get(child(dbRef, `feedback`));
      
      if (snapshot.exists()) {
        res.status(200).json(snapshot.val());
      } else {
        res.status(404).json({ message: 'Nenhum feedback encontrado' });
      }
    } catch (err) {
      console.error('Erro ao recuperar feedback:', err);
      res.status(500).json({ error: 'Erro ao recuperar feedback' });
    }
  } else {
    res.status(405).json({ message: 'Método não permitido' });
  }
}
