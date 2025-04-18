// src/VoiceInput.js
import React, {useEffect, useRef} from 'react';

const TranscribedInput = ({transcribedText}) => {
    const textareaRef = useRef(null); // Referência para o textarea

    useEffect(() => {
        // Auto-resize do textarea sempre que o texto muda
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Resetar a altura
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Ajustar para o scrollHeight
        }
    }, [transcribedText]);


    return (
        <div style={styles.container}>
      <textarea
          ref={textareaRef} // Vincular a referência
          value={transcribedText}
          placeholder="Fale algo..."
          style={styles.textarea}
          rows={1} // Começa com uma única linha
          readOnly
      />
        </div>
    );
};

const styles = {
    container: {
        display: 'flex',
        alignItems: 'flex-end', // Alinhar botões e textarea na base
        width: '100%', // Ajustar para 100% do contêiner pai
        maxWidth: '600px', // Limitar a largura máxima
        margin: '50px auto',
        padding: '0 10px', // Adicionar padding lateral
    },
    textarea: {
        flex: 1,
        padding: '10px',
        fontSize: '16px',
        resize: 'none', // Desativar a possibilidade de redimensionamento manual
        overflow: 'hidden', // Esconder barras de rolagem
        borderRadius: '4px',
        border: '1px solid #ccc',
        fontFamily: 'Arial, sans-serif',
        lineHeight: '1.5',
    }
};

export default TranscribedInput;