// src/VoiceInput.js
import React, {useState, useEffect, useRef} from 'react';
import {FaMicrophone, FaMicrophoneSlash} from 'react-icons/fa';
import axios from 'axios';

const VoiceInput = ({setTranscribedText}) => {
    const [texto, setTexto] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [recognition, setRecognition] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioChunksRef = useRef([]);
    const textareaRef = useRef(null); // Referência para o textarea
    const isManuallyStopped = useRef(false); // Referência para rastrear se o usuário parou

    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            const recog = new SpeechRecognition();
            recog.continuous = true; // Permitir reconhecimento contínuo
            recog.interimResults = false;
            recog.lang = 'pt-BR';

            recog.onstart = () => {
                console.log('Reconhecimento de voz iniciado');
                setIsListening(true);
            };

            recog.onresult = (event) => {
                const transcript = event.results[event.results.length - 1][0].transcript;
                console.log('Texto transcrito:', transcript);
                setTexto((prevText) => (prevText ? `${prevText} ${transcript}` : transcript));
            };

            recog.onerror = (event) => {
                console.error('Erro no reconhecimento de voz:', event.error);
            };

            recog.onend = () => {
                console.log('Reconhecimento de voz finalizado');
                setIsListening(false);
                if (!isManuallyStopped.current) {
                    // Reiniciar reconhecimento se não foi parado manualmente
                    console.log('Reiniciando reconhecimento de voz...');
                    recog.start();
                }
            };

            setRecognition(recog);
        } else {
            alert('Seu navegador não suporta a API de Reconhecimento de Voz.');
        }

        // Limpeza ao desmontar o componente
        return () => {
            if (recognition) {
                recognition.stop();
            }
        };
    }, []); // Executar apenas uma vez ao montar

    useEffect(() => {
        // Auto-resize do textarea sempre que o texto muda
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto'; // Resetar a altura
            textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`; // Ajustar para o scrollHeight
        }
    }, [texto]);

    const handleMicClick = async () => {
        if (recognition) {
            if (isListening) {
                console.log('Parando o reconhecimento de voz e a gravação');
                isManuallyStopped.current = true; // Indicar que a parada foi manual
                recognition.stop();
                if (mediaRecorderRef.current) {
                    mediaRecorderRef.current.stop();
                }
            } else {
                try {
                    setTexto('')
                    console.log('Solicitando acesso ao microfone');
                    const stream = await navigator.mediaDevices.getUserMedia({audio: true});
                    console.log('Acesso ao microfone concedido');

                    const mediaRecorder = new MediaRecorder(stream);
                    mediaRecorderRef.current = mediaRecorder;
                    audioChunksRef.current = []; // Garantir que está vazio antes de iniciar
                    isManuallyStopped.current = false; // Resetar a flag de parada manual

                    mediaRecorder.ondataavailable = (event) => {
                        if (event.data.size > 0) {
                            console.log('Dados de áudio disponíveis');
                            audioChunksRef.current.push(event.data);
                        }
                    };

                    mediaRecorder.onstop = () => {
                        console.log('Gravação de áudio finalizada');
                        stream.getTracks().forEach((track) => track.stop());
                        if (audioChunksRef.current.length > 0) {
                            const audioBlob = new Blob(audioChunksRef.current, {type: 'audio/webm'});
                            enviarAudio(audioBlob);
                        } else {
                            console.warn('Nenhum dado de áudio capturado');
                        }
                    };

                    mediaRecorder.start();
                    console.log('Iniciando o MediaRecorder');
                    recognition.start();
                } catch (err) {
                    console.error('Erro ao acessar o microfone:', err);
                    alert('Não foi possível acessar o microfone.');
                }
            }
        }
    };

    const enviarAudio = async (audioBlob) => {
        try {
            const formData = new FormData();
            formData.append('audio', audioBlob, 'gravacao.webm');

            console.log('Enviando áudio para o backend');

            const response = await axios.post('http://localhost:9090/upload', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.status === 200) {
                console.log('Áudio enviado com sucesso:', response.data);
                setTranscribedText(response.data.transcript);
            } else {
                console.error('Falha ao enviar o áudio:', response.statusText);
            }
        } catch (error) {
            console.error('Erro ao enviar o áudio:', error);
        }
    };

    return (
        <div style={styles.container}>
      <textarea
          ref={textareaRef} // Vincular a referência
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Fale algo..."
          style={styles.textarea}
          rows={1} // Começa com uma única linha
      />
            <button onClick={handleMicClick} style={styles.button}>
                {isListening ? <FaMicrophoneSlash size={24} color="#ff0000"/> :
                    <FaMicrophone size={24} color="#0000ff"/>}
            </button>
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
    },
    button: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        marginLeft: '10px',
        padding: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
};

export default VoiceInput;