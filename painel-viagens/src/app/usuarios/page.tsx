'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/AuthGuard';
import { useAuth } from '../../context/AuthContext';
import {
  aprovarUsuarioComoAgente,
  listarUsuarios,
  promoverUsuarioParaSupervisor,
} from '../../services/usuariosService';
import { DEFAULT_AGENCY_ID } from '../../types';
import type { UsuarioPerfil } from '../../types';

function UsuariosContent() {
  const { user, accessProfile, isAdmin, loading, profileLoading } = useAuth();
  const [usuarios, setUsuarios] = useState<UsuarioPerfil[]>([]);
  const [carregandoUsuarios, setCarregandoUsuarios] = useState(false);
  const [uidEmAprovacao, setUidEmAprovacao] = useState<string | null>(null);
  const [uidEmPromocao, setUidEmPromocao] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const podeAcessarUsuarios = isAdmin || accessProfile.role === 'admin' || accessProfile.role === 'supervisor';
  const verificandoPerfil = loading || profileLoading;

  useEffect(() => {
    if (verificandoPerfil || !podeAcessarUsuarios) {
      return;
    }

    let buscaAtiva = true;

    const buscarUsuarios = async () => {
      setCarregandoUsuarios(true);
      setErro('');

      try {
        const dados = await listarUsuarios();
        if (buscaAtiva) {
          setUsuarios(dados);
        }
      } catch (error) {
        console.error('Erro ao listar usuários:', error);
        if (buscaAtiva) {
          setUsuarios([]);
          setErro('Não foi possível carregar os usuários. Verifique se seu perfil tem permissão administrativa.');
        }
      } finally {
        if (buscaAtiva) {
          setCarregandoUsuarios(false);
        }
      }
    };

    buscarUsuarios();

    return () => {
      buscaAtiva = false;
    };
  }, [podeAcessarUsuarios, verificandoPerfil]);

  const usuariosPendentes = usuarios.filter((usuario) => usuario.status === 'pendente').length;
  const usuariosAprovados = usuarios.filter((usuario) => usuario.status === 'aprovado').length;

  const aprovarComoAgente = async (uid: string) => {
    setUidEmAprovacao(uid);
    setErro('');

    try {
      await aprovarUsuarioComoAgente(uid);
      setUsuarios((usuariosAtuais) => usuariosAtuais.map((usuario) => (
        usuario.uid === uid
          ? {
              ...usuario,
              status: 'aprovado',
              role: 'agent',
              agencyId: DEFAULT_AGENCY_ID,
            }
          : usuario
      )));
    } catch (error) {
      console.error('Erro ao aprovar usuário:', error);
      setErro('Não foi possível aprovar o usuário. Verifique se seu perfil tem permissão administrativa.');
    } finally {
      setUidEmAprovacao(null);
    }
  };

  const promoverParaSupervisor = async (uid: string) => {
    setUidEmPromocao(uid);
    setErro('');

    try {
      await promoverUsuarioParaSupervisor(uid);
      setUsuarios((usuariosAtuais) => usuariosAtuais.map((usuario) => (
        usuario.uid === uid
          ? {
              ...usuario,
              role: 'supervisor',
            }
          : usuario
      )));
    } catch (error) {
      console.error('Erro ao promover usuário:', error);
      setErro('Não foi possível promover o usuário. Verifique se seu perfil tem permissão administrativa.');
    } finally {
      setUidEmPromocao(null);
    }
  };

  if (verificandoPerfil) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
          </div>
        </div>
      </main>
    );
  }

  if (!podeAcessarUsuarios) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Usuários do CRM</h1>
          <p className="mt-3 text-sm font-medium text-slate-600">
            Acesso restrito ao administrador.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="border-l-4 border-blue-600 pl-4 text-3xl font-bold text-blue-900">
            Usuários do CRM
          </h1>
          <p className="mt-2 pl-5 text-sm font-medium text-slate-500">
            Visualização administrativa dos perfis cadastrados.
          </p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border-l-4 border-blue-500 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase text-slate-500">Total</h2>
            <p className="mt-2 text-3xl font-black text-slate-900">{usuarios.length}</p>
          </div>
          <div className="rounded-xl border-l-4 border-amber-400 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase text-slate-500">Pendentes</h2>
            <p className="mt-2 text-3xl font-black text-amber-700">{usuariosPendentes}</p>
          </div>
          <div className="rounded-xl border-l-4 border-green-500 bg-white p-5 shadow-sm">
            <h2 className="text-xs font-bold uppercase text-slate-500">Aprovados</h2>
            <p className="mt-2 text-3xl font-black text-green-700">{usuariosAprovados}</p>
          </div>
        </div>

        {erro && (
          <p className="mb-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {erro}
          </p>
        )}

        {carregandoUsuarios ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-t-2 border-blue-600"></div>
          </div>
        ) : usuarios.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm font-medium text-slate-600 shadow-sm">
            Nenhum usuário encontrado.
          </div>
        ) : (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <div className="min-w-[760px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
              <table className="w-full text-left">
                <thead className="border-b bg-slate-50 text-xs font-bold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-4 md:px-6">UID</th>
                    <th className="px-4 py-4 md:px-6">Status</th>
                    <th className="px-4 py-4 md:px-6">Perfil</th>
                    <th className="px-4 py-4 md:px-6">Agência</th>
                    <th className="px-4 py-4 md:px-6">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map((usuario) => {
                    const podePromoverParaSupervisor = usuario.status === 'aprovado'
                      && usuario.role === 'agent'
                      && usuario.uid !== user?.uid;

                    return (
                      <tr key={usuario.uid} className="text-sm text-slate-700">
                        <td className="max-w-72 break-all px-4 py-4 font-mono text-xs md:px-6">
                          {usuario.uid}
                        </td>
                        <td className="px-4 py-4 md:px-6">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-black uppercase ${
                            usuario.status === 'pendente'
                              ? 'bg-amber-50 text-amber-700'
                              : usuario.status === 'aprovado'
                                ? 'bg-green-50 text-green-700'
                                : 'bg-slate-100 text-slate-600'
                          }`}>
                            {usuario.status || 'Sem status'}
                          </span>
                        </td>
                        <td className="px-4 py-4 font-semibold md:px-6">
                          {usuario.role || 'Sem perfil'}
                        </td>
                        <td className="px-4 py-4 font-semibold md:px-6">
                          {usuario.agencyId || 'Sem agência'}
                        </td>
                        <td className="px-4 py-4 md:px-6">
                          {usuario.status === 'pendente' ? (
                            <button
                              type="button"
                              onClick={() => aprovarComoAgente(usuario.uid)}
                              disabled={uidEmAprovacao === usuario.uid}
                              className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-black uppercase text-green-700 transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {uidEmAprovacao === usuario.uid ? 'Aprovando...' : 'Aprovar como Agente'}
                            </button>
                          ) : podePromoverParaSupervisor ? (
                            <button
                              type="button"
                              onClick={() => promoverParaSupervisor(usuario.uid)}
                              disabled={uidEmPromocao === usuario.uid}
                              className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-black uppercase text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {uidEmPromocao === usuario.uid ? 'Promovendo...' : 'Promover a Supervisor'}
                            </button>
                          ) : (
                            <span className="text-xs font-semibold text-slate-400">Sem ação</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function Usuarios() {
  return (
    <AuthGuard>
      <UsuariosContent />
    </AuthGuard>
  );
}
