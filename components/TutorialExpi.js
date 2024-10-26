import React, { useState, useEffect } from 'react';
import ModalTutorial from './ui/ModalTutorial';
import { motion, AnimatePresence } from 'framer-motion';

const Tutorial = ({ onClose }) => {
  const [step, setStep] = useState(0);
  const [highlightStyle, setHighlightStyle] = useState({});

  const steps = [
    {
      target: 'welcome',
      content: 'Bem-vindo ao Expi! Este é um projeto de chat interativo com IA, onde você pode conversar, receber análises de sentimento e muito mais.',
      description: 'O Expi oferece várias funcionalidades incríveis:',
      features: [
        'Chat interativo com IA avançada',
        'Análise de sentimento em tempo real',
        'Nuvem de palavras para visualizar tópicos frequentes',
        'Histórico de conversas para fácil acesso',
        'Modo de voz para interação hands-free',
        'Feedback detalhado ao final de cada conversa'
      ]
    },
    {
      target: '.chat-input',
      content: 'Digite uma mensagem aqui para conversar com a IA.',
    },
    {
      target: '.send-button',
      content: 'Clique aqui para enviar sua mensagem.',
    },
    {
      target: '.finish-button',
      content: 'Clique aqui para finalizar a conversa e ver o feedback.',
    },
    {
      target: '.test-button',
      content: 'Agora que você já sabe como funciona, clique no avatar e faça seu cadastro com seu email aqui.',
    },
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const currentStep = steps[step];

  const getHighlightStyle = () => {
    switch (currentStep.target) {
      case '.chat-input':
        return {
          top: 730, // Ajuste a posição conforme necessário
          left: 330,
          width: 900,
          height: 93,
          borderColor: 'blue', // Cor azul da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
          color: '#ffffff'
        };
      case '.send-button':
        return {
          top: 747, // Ajuste a posição conforme necessário
          left: 1224,
          width: 80,
          height: 60,
          borderColor: 'blue', // Cor azul da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
        
        };
      case '.finish-button':
        return {
          top: 747, // Ajuste a posição conforme necessário
          left: 1291,
          width: 164,
          height: 60,
          borderColor: 'blue', // Cor azul da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
         
        };
      case '.test-button':
        return {
          top: 12, // Ajuste a posição conforme necessário
          left: 640,
          width: 163,
          height: 50,
          borderColor: 'green', // Cor verde da borda
          borderWidth: '2px', // Largura da borda
          borderStyle: 'solid', // Estilo da borda
          
        };
      default:
        return {};
    }
  };
  

  useEffect(() => {
    const style = getHighlightStyle();
    setHighlightStyle(style);
  }, [step]);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      zIndex: 9999,
    }}>
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
            backgroundColor: 'rgba(0, 0, 0, 1.8)',
            zIndex: 9998,
            pointerEvents: 'none',
            clipPath: currentStep.target === 'welcome' ? 'none' : `polygon(
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
            )`
          }}
        />
      </AnimatePresence>

      {currentStep.target === 'welcome' ? (
         <>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.8, opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            top: '12%',
            left: '23%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#1a1a2e', // Fundo azul escuro
            padding: '3rem',
            borderRadius: '1.5rem',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)',
            zIndex: 10000,
            maxWidth: '90%',
            width: '800px',
            textAlign: 'center',
          }}
        >
          <motion.h1
            initial={{ y: -50 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 120 }}
            style={{ fontSize: '3rem', marginBottom: '1.5rem', color: '#7b2cbf' }} // Azul mais claro
          >
            Bem-vindo ao Expi!
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            style={{ fontSize: '1.3rem', marginBottom: '2rem', lineHeight: '1.6', color: '#e0e0e0' }} // Texto claro
          >
            {currentStep.content}
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
          >
            
            <h3 style={{ fontSize: '1.5rem', marginBottom: '1rem', color: '#7b2cbf' }}>
              {currentStep.description}
            </h3>
            <ul style={{ textAlign: 'left', columns: 2, columnGap: '2rem', marginBottom: '2rem', color: '#e0e0e0' }}> 
              {currentStep.features.map((feature, index) => (
                <motion.li
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1 + index * 0.1 }}
                  style={{ marginBottom: '0.8rem', fontSize: '1.1rem' }}
                >
                  {feature}
                </motion.li>
              ))}
            </ul>
          </motion.div>


          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 1.30 }}
            onClick={handleNext}
            style={{
              backgroundColor: '#3a0ca3', 
              color: 'white',
              padding: '1rem 2rem',
              border: 'none',
              borderRadius: '2rem',
              fontSize: '1.2rem',
              cursor: 'pointer',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            Começar a Explorar
          </motion.button>

       
        </motion.div>
        <motion.img
            src="/robot.png"
            alt="Robot Assistant"
            initial={{ opacity: 0, x: 350 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.7, duration: 2.2 }}
            style={{
              position: 'absolute',
              top: '47%',
              right: '11%',
              transform: 'translateY(-50%)',
              width: '300px',
              height: 'auto',
              zIndex: 10001,
            }}
          />
        </>
        
      ) : (
        <>
        
          <ModalTutorial 
            isOpen={true} 
            onClose={onClose} 
            content={currentStep.content} 
            onNext={handleNext}
            onPrev={handlePrev}
            step={step}
            totalSteps={steps.length}
            highlightStyle={highlightStyle}
           
          />

          <motion.img
            src="/robot.png"
            alt="Robot Assistant"
            
            style={{
              position: 'fixed',
              top: '480px',
              right: '612px',
              width: '210px',
              height: 'auto',
              zIndex: 10001,
            }}
            animate={{
              scale: [1, 1.29, 1],
              transition: {
                duration: 3,
                repeat: Infinity,
                repeatType: 'reverse',
              },
            }}
          />
        </>
      )}

      <AnimatePresence mode="wait">
        {currentStep.target !== 'welcome' && highlightStyle.width > 0 && (
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
        )}
      </AnimatePresence>

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
