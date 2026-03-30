export interface UserData {
  uid: string;
  nome: string;
  email: string;
  role: 'admin' | 'barbeiro';
  sede: string;
  porcentagem: number;
}

export interface Servico {
  id: string;
  nome: string;
  valor: number;
}

export interface Registro {
  id: string;
  barbeiroId: string;
  barbeiroNome: string;
  sede: string;
  servicoId: string;
  servicoNome: string;
  valorTabela: number;
  desconto: number;
  valorFinal: number;
  pagamento: string;
  porcentagem: number;
  isOwnerCut: boolean;
  timestamp: any;
  data: string;
}
