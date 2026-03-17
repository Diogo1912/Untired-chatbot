import { notFound } from 'next/navigation';
import { getChatByShareToken, getChatMessages } from '@/lib/db';

export default async function SharePage({ params }: { params: { token: string } }) {
  const chat = getChatByShareToken(params.token);
  if (!chat) notFound();

  const messages = getChatMessages(chat.id);
  const date = new Date(chat.created_at).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-md bg-brand-purple flex items-center justify-center flex-shrink-0">
          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-gray-900">Untire Coach</p>
          <p className="text-xs text-gray-400">Shared session — {date}</p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
          <p className="text-xs text-amber-700">
            This is a read-only view of a coaching session shared from Untire Coach. Content is not medical advice.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {messages
            .filter(m => m.content && m.role !== 'system')
            .map((m: any) => (
              <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-brand-purple text-white rounded-br-sm'
                    : 'bg-white text-gray-800 shadow-sm border border-gray-100 rounded-bl-sm'
                }`}>
                  {m.content}
                </div>
              </div>
            ))}
        </div>

        <p className="mt-10 text-center text-xs text-gray-400">
          Untire Coach — Not medical advice · Tired of Cancer B.V.
        </p>
      </main>
    </div>
  );
}
