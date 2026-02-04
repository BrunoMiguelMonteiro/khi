import { KoboIcon } from '@/app/components/KoboIcon';
import { motion } from 'motion/react';

export function ImportingScreen() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center space-y-6 max-w-md">
        <motion.div
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <KoboIcon />
        </motion.div>
        <motion.p
          className="text-neutral-700 dark:text-neutral-300 text-lg"
          animate={{ opacity: [1, 0.6, 1] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          Kobo detected. Importing books, please wait...
        </motion.p>
      </div>
    </div>
  );
}
