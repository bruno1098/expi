import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'; // Ajuste o caminho conforme necessário

const GptChat = ({ userName, userId, onMessagesUpdate }) => {
  const [messages, setMessages] = useState([]);
  const [isConversationActive, setIsConversationActive] = useState(false);
  const [voices, setVoices] = useState([]);
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Flag para controlar a síntese de fala
  const recognition = useRef(null);
  const synthesisUtterance = useRef(null);
  const lastTranscript = useRef(''); // Ref para armazenar a última transcrição

  // Carregar vozes disponíveis
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      console.log('Vozes disponíveis:', availableVoices);
      setVoices(availableVoices);
      // Não pré-seleciona uma voz para permitir que o usuário escolha ou opte por não usar voz
    };

    // Carregar vozes inicialmente
    loadVoices();

    // Atualizar vozes quando mudarem
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // Inicializar o reconhecimento de fala
  useEffect(() => {
    // Verificar se estamos no ambiente do navegador
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.error('API de reconhecimento de fala não suportada neste navegador.');
      return;
    }

    recognition.current = new SpeechRecognition();
    recognition.current.continuous = true; // Manter reconhecimento contínuo
    recognition.current.interimResults = false;
    recognition.current.lang = 'pt-BR';

    recognition.current.onresult = async (event) => {
      if (isSpeaking) {
        console.log('Ignorando resultado durante a síntese de fala.');
        return;
      }

      const result = event.results[event.resultIndex];
      const transcript = result[0].transcript.trim();

      // Verifique se a transcrição é diferente da última
      if (transcript && transcript !== lastTranscript.current) {
        lastTranscript.current = transcript;

        console.log('Transcrição recebida:', transcript);
        addMessage({ senderId: userId, senderName: userName || 'Você', content: transcript });

        const response = await sendMessageToGPT(transcript);

        if (response) {
          addMessage({ senderId: 'gpt', senderName: 'Expi', content: response });

          if (selectedVoice) {
            console.log('Usando a voz selecionada:', selectedVoice.name);
            const utterance = new SpeechSynthesisUtterance(response);
            utterance.voice = selectedVoice;
            synthesisUtterance.current = utterance;

            utterance.onstart = () => {
              setIsSpeaking(true);
              console.log('Síntese de fala iniciada.');
            };

            utterance.onend = () => {
              synthesisUtterance.current = null;
              setIsSpeaking(false);
              console.log('Síntese de fala finalizada.');
            };

            window.speechSynthesis.speak(utterance);
          }
        }
      } else {
        console.log('Transcrição repetida ou vazia, ignorando.');
      }
    };

    recognition.current.onstart = () => {
      console.log('Reconhecimento de fala iniciado.');
    };

    recognition.current.onend = () => {
      console.log('Reconhecimento de fala finalizado.');
      if (isConversationActive && !isSpeaking) {
        console.log('Reiniciando reconhecimento de fala...');
        recognition.current.start();
      }
    };

    recognition.current.onerror = (event) => {
      console.error('Erro no reconhecimento de fala:', event.error);
      if (isConversationActive) {
        console.log('Tentando reiniciar reconhecimento de fala após erro...');
        setTimeout(() => {
          try {
            recognition.current.start();
          } catch (err) {
            console.error('Erro ao reiniciar reconhecimento de fala:', err);
          }
        }, 1000); // Espera 1 segundo antes de tentar reiniciar
      }
    };

    return () => {
      if (recognition.current) {
        recognition.current.stop();
        recognition.current = null;
      }
      window.speechSynthesis.cancel();
    };
  }, [userId, userName, selectedVoice, isConversationActive]); // Removido 'isSpeaking' das dependências

  // Iniciar o reconhecimento de fala e a conversa
  const startListening = async () => {
    if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      alert('Reconhecimento de fala não suportado neste navegador.');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      if (recognition.current && !isConversationActive) {
        setIsConversationActive(true);
        recognition.current.start();
        console.log('Reconhecimento de fala iniciado pelo usuário.');
      }
    } catch (err) {
      console.error('Permissão de microfone negada:', err);
      alert('Por favor, permita o acesso ao microfone.');
    }
  };

  // Parar o reconhecimento de fala e a síntese de fala
  const stopListening = () => {
    if (recognition.current && isConversationActive) {
      setIsConversationActive(false);
      recognition.current.stop();
      console.log('Reconhecimento de fala parado pelo usuário.');
    }
    window.speechSynthesis.cancel();
  };

  // Adicionar mensagem ao estado e notificar o componente pai
  const addMessage = (message) => {
    setMessages((prevMessages) => {
      const newMessages = [...prevMessages, message];
      if (onMessagesUpdate) {
        onMessagesUpdate(newMessages);
      }
      return newMessages;
    });
  };

  // Enviar mensagem para a API do GPT e adicionar a resposta
  const sendMessageToGPT = async (userMessage) => {
    try {
      setIsLoading(true);

      const apiUrl = 'https://api.openai.com/v1/chat/completions';

      const conversation = [
        {
          role: 'system',
          content: `
          Você é um assistente de vendas da **Plusoft Hike for Sales**. Quando um cliente expressa interesse em contratar o serviço, responda da seguinte maneira:

1. **Agradecimento Inicial:**
   - Inicie com uma mensagem calorosa, por exemplo:
     "Fico feliz que você queira contratar nosso serviço Hike for Sales!"

2. **Apresentação dos Benefícios:**
   - Liste os principais benefícios da plataforma, destacando como ela maximiza a eficiência e a gestão das operações comerciais. Utilize marcadores para clareza. Por exemplo:
     - **Eficiência Operacional:** Automatiza processos de vendas, economizando tempo e recursos.
     - **Gestão de Equipes:** Ferramentas avançadas para monitorar e gerenciar o desempenho da equipe de vendas.
     - **Adaptabilidade:** Ideal para vendedores, representantes comerciais e líderes de equipe de vendas.
     - **Análises e Relatórios:** Fornece insights detalhados para tomar decisões informadas.

3. **Agendamento de Reunião:**
   - Finalize oferecendo agendar uma reunião com um consultor de forma amigável e profissional. Por exemplo:
     "Gostaria de agendar uma reunião com um de nossos consultores para discutir como podemos atender às suas necessidades? Podemos marcar para **quinta-feira, 25 de abril às 10h**. Esse horário funciona para você?"

**Exemplo de Resposta Completa:**

"Fico feliz que você queira contratar nosso serviço Hike for Sales! Nossa plataforma oferece os seguintes benefícios:

- **Eficiência Operacional:** Automatiza processos de vendas, economizando tempo e recursos.
- **Gestão de Equipes:** Ferramentas avançadas para monitorar e gerenciar o desempenho da equipe de vendas.
- **Adaptabilidade:** Ideal para vendedores, representantes comerciais e líderes de equipe de vendas.
- **Análises e Relatórios:** Fornece insights detalhados para tomar decisões informadas.

Gostaria de agendar uma reunião com um de nossos consultores para discutir como podemos atender às suas necessidades? Podemos marcar para **quinta-feira, 25 de abril às 10h**. Esse horário funciona para você?"

este sao exemplos, mas deixe de uma forma BEM MAIS RESUMIDA
    `,
        },
        ...messages.map((msg) => ({
          role: msg.senderId === 'gpt' ? 'assistant' : 'user',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await axios.post(
        apiUrl,
        {
          model: 'gpt-4',
          messages: conversation,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.NEXT_PUBLIC_OPENAI_API_KEY}`,
          },
        }
      );

      const assistantMessage = response.data.choices[0].message.content.trim();
      return assistantMessage;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-start h-full bg-background p-4">
      <h2 className="text-2xl font-bold mb-4">Expi Express</h2>

      {/* Seletor de voz */}
      <div className="mb-4">
        <label htmlFor="voiceSelect" className="mr-2">
          Escolha a voz:
        </label>
        <select
          id="voiceSelect"
          value={selectedVoice ? selectedVoice.name : ''}
          onChange={(e) => {
            const voice = voices.find((v) => v.name === e.target.value);
            setSelectedVoice(voice || null); // Define como null se não encontrar
            console.log('Voz selecionada:', voice);
          }}
          className="p-2 border rounded-md bg-white dark:bg-gray-800 text-black dark:text-white border-gray-300 dark:border-gray-600"
        >
          <option value="">-- Selecione uma voz --</option>
          {voices
            .filter((voice) => voice.lang.includes('pt'))
            .map((voice, index) => (
              <option key={index} value={voice.name}>
                {voice.name} ({voice.lang})
              </option>
            ))}
        </select>
      </div>

      {/* Botões para controlar o reconhecimento de fala */}
      <div className="mb-4">
        {!isConversationActive ? (
          <button
            onClick={startListening}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md"
          >
            Iniciar Conversa
          </button>
        ) : (
          <button
            onClick={stopListening}
            className="px-4 py-2 bg-red-500 text-white rounded-md"
          >
            Parar Conversa
          </button>
        )}
      </div>

      {/* Botão de teste de síntese de fala */}
      <div className="mb-4">
        <button
          onClick={() => {
            if (selectedVoice) {
              const utterance = new SpeechSynthesisUtterance('Teste de síntese de fala.');
              utterance.voice = selectedVoice;
              window.speechSynthesis.speak(utterance);
            } else {
              alert('Por favor, selecione uma voz primeiro.');
            }
          }}
          className="px-4 py-2 bg-secondary text-white rounded-md"
        >
          Testar Síntese de Fala
        </button>
      </div>

      {/* Indicador de carregamento */}
      {isLoading && (
        <div className="flex items-center justify-center mt-4">
          <div className="loader"></div>
          <span className="ml-2">Aguardando resposta...</span>
        </div>
      )}

      {/* Lista de Mensagens */}

    </div>
  );
};

export default GptChat;
