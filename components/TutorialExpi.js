import React, { useState, useEffect } from 'react';
import ModalTutorial from './ui/ModalTutorial'; // Importando o componente ModalTutorial
import { motion, AnimatePresence } from 'framer-motion';

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(0); // Controla os passos do tutorial

  const steps = [
    {
      target: '.chat-input', // Seleciona o campo de mensagem
      content: 'Digite uma mensagem aqui para conversar com a IA.',
    },
    {
      target: '.send-button', // Seleciona o botão de enviar mensagem
      content: 'Clique aqui para enviar sua mensagem.',
    },
    {
      target: '.finish-button', // Seleciona o botão de finalizar conversa
      content: 'Clique aqui para finalizar a conversa e ver o feedback.',
    },
    {
        target: '.test-button', // Seleciona o botão de finalizar conversa
        content: 'Agora que vc ja sabe como funciona, faça seu cadastro com seu email aqui.',
      },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);  // Atualiza o passo para o próximo
    } else {
      onClose(); // Fecha o tutorial ao final
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);  // Volta para o passo anterior
    }
  };

  const currentStep = steps[step]; // Pega o passo atual baseado no estado

  // Função para gerar o estilo do destaque baseado no passo atual
  const getHighlightStyle = () => {
    switch (currentStep.target) {
      case '.chat-input':
        return {
          top: 690, // Ajuste a posição conforme necessário
          left: 337,
          width: 880,
          height: 80,
          
          borderColor: 'blue', // Cor amarela da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
        };
      case '.send-button':
        return {
          top: 700, // Ajuste a posição conforme necessário
          left: 1224,
          width: 80,
          height: 60,
    
          borderColor: 'blue', // Cor amarela da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
        };
      case '.finish-button':
        return {
          top: 700, // Ajuste a posição conforme necessário
          left: 1291,
          width: 164,
          height: 60,
  
          borderColor: 'blue', // Cor amarela da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
        };
        case '.test-button':
            return {
              top: 12, // Ajuste a posição conforme necessário
              left: 640,
              width: 163,
              height: 50,
 
              borderColor: 'green', // Cor amarela da borda
              borderWidth: '2px', // Largura da borda
              borderStyle: 'solid', // Estilo da borda
            };
      default:
        return {};
    }
  };

  const highlightStyle = getHighlightStyle();

  useEffect(() => {
    // Recalcula o destaque sempre que o step mudar
  }, [step]); // Agora o componente re-renderiza sempre que o `step` muda

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 9999,
    }}>
      {/* Fundo escurecido com o recorte */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.8 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.8)', // Fundo escurecido
            zIndex: 9998,
            pointerEvents: 'none', // Apenas o fundo não é clicável
            clipPath: `polygon(
              0 0, 
              0 100%, 
              ${highlightStyle.left}px 100%, 
              ${highlightStyle.left}px ${highlightStyle.top}px, 
              ${highlightStyle.left + highlightStyle.width}px ${highlightStyle.top}px, 
              ${highlightStyle.left + highlightStyle.width}px ${highlightStyle.top + highlightStyle.height}px, 
              ${highlightStyle.left}px ${highlightStyle.top + highlightStyle.height}px, 
              ${highlightStyle.left}px 100%, 
              100% 100%, 
              100% 0
            )` // Cria o "buraco" em volta do elemento destacado
          }}
        />
      </AnimatePresence>

      {/* ModalTutorial ao lado do destaque */}
      <ModalTutorial 
        isOpen={true} 
        onClose={onClose} 
        content={currentStep.content} 
        onNext={handleNext}
        onPrev={handlePrev}
        step={step}
        totalSteps={steps.length}
        highlightStyle={highlightStyle} // Enviando o estilo do destaque
      />

      {/* Destaque ao redor do elemento */}
      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ duration: 0.5 }}
          className="highlight-box"
          style={{
            position: 'absolute',
            top: `${highlightStyle.top}px`,
            left: `${highlightStyle.left}px`,
            width: `${highlightStyle.width}px`,
            height: `${highlightStyle.height}px`,
            border: `${highlightStyle.borderWidth} ${highlightStyle.borderStyle} ${highlightStyle.borderColor}`,
            backgroundColor: 'transparent',
            borderRadius: highlightStyle.borderRadius,
            zIndex: 10000,
            pointerEvents: 'auto',
          }}
        />
      </AnimatePresence>

      {/* Adicionando a animação de pulso e outros estilos */}
      <style jsx>{`
        .highlight-box {
          animation: pulseBorder 2s infinite;
        }

        @keyframes pulseBorder {
          0% {
            box-shadow: 0 0 10px 5px rgba(255, 255, 0, 0.6);
          }
          50% {
            box-shadow: 0 0 20px 10px rgba(255, 255, 0, 1);
          }
          100% {
            box-shadow: 0 0 10px 5px rgba(255, 255, 0, 0.6);
          }
        }
      `}</style>
    </div>
  );
};

export default Tutorial;
