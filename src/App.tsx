import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import StringsLinks from './components/strings/StringsLinks';
import NewsletterScreen from './components/NewsletterScreen';
import ProjectScreen from './components/ProjectScreen';
import ContactScreen from './components/ContactScreen';
import type { LinkAction } from './config/links';

/** Los formularios se pensaron como overlay del móvil: aquí ocupan toda la pantalla (o una columna en escritorio). */
function ModalLayer({ onClose, children }: Readonly<{ onClose: () => void; children: ReactNode }>) {
  return (
    <div
      className="fixed inset-0 z-[100] flex justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative h-full w-full max-w-[480px] [&>div]:!rounded-none">{children}</div>
    </div>
  );
}

function App() {
  const [modal, setModal] = useState<LinkAction | null>(null);
  const close = useCallback(() => setModal(null), []);

  return (
    <main className="harp-page">
      <StringsLinks onAction={setModal} paused={modal !== null} />

      {modal ? (
        <ModalLayer onClose={close}>
          {modal === 'newsletter' ? <NewsletterScreen onClose={close} /> : null}
          {modal === 'project' ? <ProjectScreen onClose={close} /> : null}
          {modal === 'contact' ? <ContactScreen onClose={close} /> : null}
        </ModalLayer>
      ) : null}
    </main>
  );
}

export default App;
