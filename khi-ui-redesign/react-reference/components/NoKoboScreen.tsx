import { KoboIcon } from '@/app/components/KoboIcon';

interface NoKoboScreenProps {
  onConnect?: () => void;
}

export function NoKoboScreen({ onConnect }: NoKoboScreenProps) {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6 max-w-md">
        <KoboIcon dashed disabled />
        <div className="space-y-4">
          <p className="text-neutral-400 dark:text-neutral-600 text-lg">
            There's no Kobo connected.<br />Please connect your Kobo e-reader.
          </p>
          {onConnect && (
            <button
              onClick={onConnect}
              className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 hover:bg-neutral-300 dark:hover:bg-neutral-700 rounded transition-colors"
            >
              Simulate Connection (Dev)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}