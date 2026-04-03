import React, { useState } from 'react';
import { Mail, Lock, ArrowRight } from 'lucide-react';

interface AuthScreenProps {
  onSignIn: (email: string, password: string, isSignUp: boolean) => Promise<void>;
  error: string;
}

export function AuthScreen({ onSignIn, error }: AuthScreenProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nome, setNome] = useState('');
  const [sede, setSede] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await onSignIn(email, password, isSignUp);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-card">
      <h2>{isSignUp ? 'Criar Conta' : 'Entrar'}</h2>
      
      {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {isSignUp && (
          <>
            <div className="field">
              <label>Nome Completo</label>
              <input
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="field">
              <label>Sede</label>
              <input
                type="text"
                value={sede}
                onChange={(e) => setSede(e.target.value)}
                placeholder="Sua sede"
                required
              />
            </div>
          </>
        )}

        <div className="field">
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            required
          />
        </div>

        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
        </div>

        <button 
          type="submit" 
          className="btn btn-gold"
          disabled={isLoading}
          style={{ opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
        </button>
      </form>

      <button
        onClick={() => {
          setIsSignUp(!isSignUp);
          setNome('');
          setSede('');
          setEmail('');
          setPassword('');
        }}
        className="btn btn-ghost"
      >
        {isSignUp ? 'Já tem conta? Entrar' : 'Não tem conta? Criar'}
      </button>
    </div>
  );
}
