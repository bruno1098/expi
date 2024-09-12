import React from 'react';
import { useSpring, animated } from '@react-spring/web'; // Importar as ferramentas necessárias do react-spring
import { ClipLoader } from 'react-spinners'; // Importar o spinner

const Modal = ({ isOpen, onClose, title, children, isLoading }) => {
  const animation = useSpring({
    opacity: isOpen ? 1 : 0,
    transform: isOpen ? `translateY(0%)` : `translateY(-50%)`,
    config: { tension: 300, friction: 20 }, // Configurações para controlar a suavidade da animação
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <animated.div style={animation} className="relative bg-background text-foreground rounded-lg shadow-lg p-6 max-w-md w-full z-50">
        
        <h2 className="text-xl font-semibold">{title}</h2>

        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <ClipLoader size={50} color={"#123abc"} loading={isLoading} />
          </div>
        ) : (
          <div>{children}</div>
        )}
        
        <div className="mt-4 text-right">
          <button onClick={onClose} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600" type="button">
            Fechar
          </button>
        </div>
        
      </animated.div>
    </div>
  );
};

export default Modal;
