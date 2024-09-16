import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get, remove, runTransaction } from "firebase/database";

// Configurações do Firebase com suas credenciais
const firebaseConfig = {

  apiKey: "AIzaSyBoCA8htD7kcfCMfephG6O1oKlrG2hbGzU",
  authDomain: "expi-e7219.firebaseapp.com",
  databaseURL: "https://expi-e7219-default-rtdb.firebaseio.com",
  projectId: "expi-e7219",
  storageBucket: "expi-e7219.appspot.com",
  messagingSenderId: "873889751904",
  appId: "1:873889751904:web:041d5ea449384087727405"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);
const database = getDatabase(app);

export const allowCors = (fn) => async (req, res) => {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  return await fn(req, res);
};

export const getNextFeedbackId = async () => {
  const idRef = ref(database, 'feedbackCounter/id');
  
  const nextId = await runTransaction(idRef, (currentId) => {
    return (currentId || 0) + 1;
  });

  return nextId.snapshot.val();
};

export const getNextUraId = async () => {
  const idRef = ref(database, 'uraCounter/id');
  
  const nextId = await runTransaction(idRef, (currentId) => {
    return (currentId || 0) + 1;
  });

  return nextId.snapshot.val();
};

export const getNextConversationId = async () => {
  const idRef = ref(database, 'conversationCounter/id');

  const nextId = await runTransaction(idRef, (currentId) => {
    return (currentId || 0) + 1;
  });

  return nextId.snapshot.val();
};

// Função para salvar uma conversa no Firebase
export const saveConversationToFirebase = async (conversationId, conversationData) => {
  try {
    const conversationRef = ref(database, `conversations/${conversationId}`);
    await set(conversationRef, conversationData);
    console.log("Conversa salva com sucesso!");
  } catch (error) {
    console.error("Erro ao salvar conversa no Firebase:", error);
  }
};

export const deleteConversationFromFirebase = async (conversationId) => {
  try {
    const conversationRef = ref(database, `conversations/${conversationId}`);
    await remove(conversationRef); // Certifica-se de que a conversa foi removida
    console.log("Conversa excluída com sucesso do Firebase!");
  } catch (error) {
    console.error("Erro ao excluir conversa no Firebase:", error);
    throw error; // Re-lança o erro para que ele possa ser tratado corretamente
  }
};



// Função para gerar o próximo ID único de usuário
export const getNextUserId = async () => {
  const idRef = ref(database, 'userCounter/id');
  const nextId = await runTransaction(idRef, (currentId) => {
    return (currentId || 0) + 1;
  });

  return nextId.snapshot.val();
};

// Função para salvar um usuário no Firebase
export const saveUserToFirebase = async (userId, userName) => {
  try {
    const userRef = ref(database, `users/${userId}`);
    await set(userRef, {
      id: userId,
      name: userName,
    });
    console.log("Usuário salvo com sucesso no Firebase!");
  } catch (error) {
    console.error("Erro ao salvar usuário no Firebase:", error);
    throw error;
  }
};

const handler = async (req, res) => {
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
};

// Exportando a função handler com CORS habilitado
export default allowCors(handler);

export { database }; // Exportando o database para ser usado em outros arquivos
