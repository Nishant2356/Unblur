"use client";

import React, { useState, useEffect, useRef } from 'react';
import { Send, Clock, Users, Trophy, Image as ImageIcon, KeyRound, PlusCircle } from 'lucide-react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001';
const socket: Socket = io(SOCKET_URL);

type GameStatus = 'lobby' | 'starting' | 'playing' | 'round_end' | 'game_over';

interface Player {
  id: string;
  name: string;
  score: number;
  hasGuessed: boolean;
}

interface ChatMessage {
  id: number;
  sender: string;
  text: string;
  isSystem?: boolean;
  isCorrect?: boolean;
}

interface InitialState {
  status: GameStatus;
  currentRound: number;
  timeLeft: number;
  players: Player[];
  currentImageUrl?: string;
  category?: string;
}

interface RoundStartedData {
  round: number;
  timeLeft: number;
  players: Player[];
  currentImageUrl: string;
  category: string;
}

export default function App() {
  // Navigation State
  const [currentView, setCurrentView] = useState<'landing' | 'room'>('landing');
  const [roomId, setRoomId] = useState<string>('');
  const [joinCodeInput, setJoinCodeInput] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');

  // Game State
  const [gameState, setGameState] = useState<GameStatus>('lobby');
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');

  // Local UI State
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [guessInput, setGuessInput] = useState<string>('');
  const [myId, setMyId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');

  const [selectedCategory, setSelectedCategory] = useState<string>('pokemon');
  const [numberOfRounds, setNumberOfRounds] = useState<number>(3);
  const [activeCategory, setActiveCategory] = useState<string>('pokemon');

  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    socket.on('connect', () => {
      setMyId(socket.id as string);
    });

    // Room Navigation Events
    socket.on('joined_room', (id: string) => {
      setRoomId(id);
      setCurrentView('room');
      setErrorMsg('');
    });

    socket.on('error_message', (msg: string) => {
      setErrorMsg(msg);
    });

    // Game Events
    socket.on('initial_state', (state: InitialState) => {
      setGameState(state.status);
      setCurrentRound(state.currentRound);
      setTimeLeft(state.timeLeft);
      setPlayers(state.players);
      if (state.category) setActiveCategory(state.category);
      if (state.currentImageUrl) setCurrentImageUrl(state.currentImageUrl);
    });

    socket.on('leaderboard_update', (updatedPlayers: Player[]) => {
      setPlayers(updatedPlayers);
    });

    socket.on('chat_message', (msg: any) => {
      setChatMessages(prev => [...prev, { ...msg, id: Date.now() + Math.random() }]);
    });

    socket.on('round_started', (data: RoundStartedData) => {
      setGameState('playing');
      setCurrentRound(data.round);
      setTimeLeft(data.timeLeft);
      setPlayers(data.players);
      setCurrentImageUrl(data.currentImageUrl);
      if (data.category) setActiveCategory(data.category);
      setChatMessages([]);
    });

    socket.on('timer_update', (serverTime: number) => {
      setTimeLeft(serverTime);
    });

    socket.on('game_starting', () => {
      setGameState('starting');
    });

    socket.on('round_ended', () => {
      setGameState('round_end');
    });

    socket.on('game_over', () => {
      setGameState('game_over');
    });

    return () => {
      socket.off('connect');
      socket.off('joined_room');
      socket.off('error_message');
      socket.off('initial_state');
      socket.off('leaderboard_update');
      socket.off('chat_message');
      socket.off('game_starting');
      socket.off('round_started');
      socket.off('timer_update');
      socket.off('round_ended');
      socket.off('game_over');
    };
  }, []);

  // Actions
  const handleCreateRoom = () => {
    if (!playerName.trim()) { setErrorMsg("Please enter your name first."); return; }
    socket.emit('create_room', playerName.trim());
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) { setErrorMsg("Please enter your name first."); return; }
    if (joinCodeInput.trim()) {
      socket.emit('join_room', joinCodeInput, playerName.trim());
    }
  };

  const startGame = () => {
    setGameState('starting');
    socket.emit('start_game', selectedCategory, numberOfRounds);
  };

  const submitGuess = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!guessInput.trim() || gameState !== 'playing') return;
    socket.emit('submit_guess', guessInput);
    setGuessInput('');
  };

  const me = players.find(p => p.id === myId);
  const currentBlur = Math.max(0, timeLeft * 1.5);

  // ==========================================
  // VIEW: LANDING PAGE
  // ==========================================
  if (currentView === 'landing') {
    return (
      <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700">
          <div className="p-8 text-center bg-slate-900/50 border-b border-slate-700">
            <div className="flex justify-center mb-4">
              <ImageIcon className="text-blue-400" size={48} />
            </div>
            <h1 className="text-4xl font-extrabold tracking-tight mb-2">Unblur<span className="text-blue-400">.io</span></h1>
            <p className="text-slate-400">The ultimate image guessing game.</p>
          </div>

          <div className="p-8 space-y-8">
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg text-sm text-center font-medium">
                {errorMsg}
              </div>
            )}

            <div className="space-y-2 text-left">
              <label className="text-sm font-semibold text-slate-300 ml-1">Your Name</label>
              <input
                type="text"
                placeholder="Enter your nickname"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                maxLength={12}
                className="w-full bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 font-medium"
                suppressHydrationWarning
              />
            </div>

            <button
              onClick={handleCreateRoom}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20"
              suppressHydrationWarning
            >
              <PlusCircle size={24} /> Create Private Room
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-700"></div>
              <span className="flex-shrink-0 mx-4 text-slate-500 text-sm font-semibold">OR</span>
              <div className="flex-grow border-t border-slate-700"></div>
            </div>

            <form onSubmit={handleJoinRoom} className="space-y-3">
              <label className="text-sm font-semibold text-slate-300">Join a Friend's Room</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 4-letter Code"
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                  maxLength={4}
                  className="flex-1 bg-slate-950 border border-slate-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-blue-500 text-center font-mono font-bold tracking-widest text-lg"
                  suppressHydrationWarning
                />
                <button type="submit" className="bg-slate-700 hover:bg-slate-600 px-6 rounded-xl font-bold transition-colors flex items-center justify-center" suppressHydrationWarning>
                  <KeyRound size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================
  // VIEW: IN-GAME ROOM
  // ==========================================
  return (
    <div className="min-h-screen bg-slate-900 text-white font-sans flex flex-col items-center justify-center p-2 sm:p-4">

      <header className="w-full max-w-6xl mb-2 sm:mb-4 flex flex-wrap gap-2 sm:gap-4 justify-between items-center bg-slate-800 p-3 sm:p-4 rounded-xl shadow-lg border border-slate-700">
        <div className="flex items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2">
            <ImageIcon className="text-blue-400 w-6 h-6 sm:w-7 sm:h-7" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight hidden sm:block">Unblur<span className="text-blue-400">.io</span></h1>
          </div>
          {/* ROOM CODE DISPLAY */}
          <div className="bg-slate-950 border border-slate-700 px-3 sm:px-4 py-1 sm:py-1.5 rounded-lg flex items-center gap-1 sm:gap-2">
            <span className="text-slate-400 text-[10px] sm:text-xs font-semibold uppercase tracking-wider hidden sm:inline">Room Code:</span>
            <span className="text-slate-400 text-[10px] font-semibold uppercase tracking-wider sm:hidden">Code:</span>
            <span className="font-mono text-blue-400 text-sm sm:text-base font-bold tracking-widest select-all">{roomId}</span>
          </div>
        </div>

        {gameState !== 'lobby' && (
          <div className="flex items-center gap-3 sm:gap-6">
            <div className="hidden sm:flex items-center px-3 py-1 bg-slate-700 rounded-full text-xs font-bold uppercase text-slate-300 tracking-wider">
              {activeCategory}
            </div>
            <div className="flex items-center gap-2">
              <Clock className={timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-yellow-400"} />
              <span className={`text-xl font-mono font-bold ${timeLeft <= 10 ? "text-red-400" : ""}`}>
                00:{timeLeft.toString().padStart(2, '0')}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-300">
              <Trophy size={20} className="text-yellow-500" />
              <span className="font-semibold hidden sm:inline">Round {currentRound + 1}</span>
              <span className="font-semibold sm:hidden">{currentRound + 1}</span>
            </div>
          </div>
        )}
      </header>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-4 flex-1 max-h-[800px]">

        {/* LEADERBOARD */}
        <div className="hidden md:flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg">
          <div className="bg-slate-950 p-4 border-b border-slate-700 flex items-center gap-2">
            <Users className="text-slate-400" size={20} />
            <h2 className="font-semibold">Lobby ({players.length})</h2>
          </div>
          <div className="p-2 flex-1 overflow-y-auto">
            {[...players].sort((a, b) => b.score - a.score).map((player, idx) => (
              <div
                key={player.id}
                className={`flex justify-between items-center p-3 mb-2 rounded-lg ${player.id === myId ? 'bg-blue-600/20 border border-blue-500/30' : 'bg-slate-700/50'} ${player.hasGuessed ? 'border-green-500/50 bg-green-500/10' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-slate-400 font-bold w-4">{idx + 1}.</span>
                  <span className={`font-medium truncate max-w-[100px] ${player.id === myId ? 'text-blue-400' : 'text-slate-200'}`}>
                    {player.id === myId ? 'You' : player.name}
                  </span>
                </div>
                <div className="font-mono text-yellow-400 font-bold">{player.score}</div>
              </div>
            ))}
          </div>
        </div>

        {/* GAME CANVAS */}
        <div className="md:col-span-2 flex flex-col bg-slate-800 rounded-xl border border-slate-700 overflow-hidden shadow-lg relative">

          {gameState === 'lobby' && (
            <div className="absolute inset-0 z-20 bg-slate-900/90 flex flex-col items-center justify-center p-4 sm:p-8 text-center overflow-y-auto">
              <h2 className="text-3xl sm:text-4xl font-extrabold mb-4 mt-auto sm:mt-0">Guess the Image</h2>
              <p className="text-sm sm:text-base text-slate-400 mb-6 max-w-md">
                Waiting for friends? Give them the Room Code: <span className="text-white font-mono bg-slate-800 px-2 py-1 rounded">{roomId}</span>
              </p>

              <div className="mb-6 sm:mb-8 w-full max-w-xs text-left space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Select a Category</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 text-white rounded-lg p-3 outline-none focus:border-blue-500 transition-colors cursor-pointer text-sm sm:text-base"
                  >
                    <option value="pokemon">Pokémon (Gen 1)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-slate-300 mb-2">Number of Rounds: <span className="text-white font-bold">{numberOfRounds}</span></label>
                  <input
                    type="range"
                    min="3"
                    max="10"
                    value={numberOfRounds}
                    onChange={(e) => setNumberOfRounds(parseInt(e.target.value))}
                    className="w-full cursor-pointer accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-slate-500 px-1 mt-1 font-mono">
                    <span>3</span>
                    <span>10</span>
                  </div>
                </div>
              </div>

              <button
                onClick={startGame}
                className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 sm:px-8 sm:py-4 rounded-full font-bold text-lg sm:text-xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(37,99,235,0.4)] mt-auto sm:mt-0 mb-4 sm:mb-0"
                suppressHydrationWarning
              >
                Start Game
              </button>
            </div>
          )}

          {gameState === 'starting' && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-8 text-center">
              <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-blue-500 mb-6"></div>
              <h2 className="text-3xl font-extrabold mb-2 text-white">Fetching Images...</h2>
              <p className="text-slate-400 text-lg">Waking up the database, please wait!</p>
            </div>
          )}

          {gameState === 'game_over' && (
            <div className="absolute inset-0 z-20 bg-slate-900/95 flex flex-col items-center justify-center p-8 text-center">
              <Trophy size={64} className="text-yellow-400 mb-4" />
              <h2 className="text-4xl font-extrabold mb-2">Game Over!</h2>
              <p className="text-slate-300 text-xl mb-8">
                Winner: {players.length > 0 ? [...players].sort((a, b) => b.score - a.score)[0].name : "No one"}
              </p>
              <button
                onClick={() => setGameState('lobby')}
                className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-full font-bold text-lg transition-all"
              >
                Back to Lobby
              </button>
            </div>
          )}

          {/* Image Display */}
          <div className="flex-1 min-h-[150px] sm:min-h-[300px] relative bg-black overflow-hidden flex items-center justify-center">
            {gameState !== 'lobby' && currentImageUrl && (
              <>
                <img
                  key={currentRound}
                  src={currentImageUrl}
                  alt="Mystery"
                  className="absolute inset-0 w-full h-full object-cover transition-all duration-1000 ease-linear"
                  style={{
                    filter: gameState === 'playing' ? `blur(${currentBlur}px)` : 'blur(0px)',
                    transform: gameState === 'playing' ? `scale(${1 + (currentBlur / 100)})` : 'scale(1)'
                  }}
                />

                {gameState === 'round_end' && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm p-4 text-center border-t border-slate-700">
                    <p className="text-green-400 font-bold text-xl uppercase">Round Ended!</p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat Box */}
          <div className="h-48 sm:h-64 flex flex-col bg-slate-900 border-t border-slate-700">
            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2">
              {chatMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm ${msg.isSystem ? (msg.isCorrect ? 'text-green-400 font-bold' : 'text-blue-400 font-medium') : 'text-slate-200'}`}
                >
                  {!msg.isSystem && <span className="font-bold mr-2 text-slate-500">{msg.sender === me?.name ? 'You' : msg.sender}:</span>}
                  <span className={msg.isSystem ? 'italic' : ''}>{msg.text}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={submitGuess} className="p-3 bg-slate-950 flex gap-2 border-t border-slate-800">
              <input
                type="text"
                value={guessInput}
                onChange={(e) => setGuessInput(e.target.value)}
                placeholder={me?.hasGuessed ? "You already guessed correctly!" : "Type your guess here..."}
                disabled={gameState !== 'playing' || me?.hasGuessed}
                className="flex-1 bg-slate-800 text-white px-4 py-2 rounded-lg border border-slate-700 focus:outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={gameState !== 'playing' || !guessInput.trim() || me?.hasGuessed}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 text-white p-2 rounded-lg transition-colors"
              >
                <Send size={20} />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}