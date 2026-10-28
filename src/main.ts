import { createGameApplication } from '@/app/GameApplication';
import { startExclusiveApplication } from '@/app/ExclusiveApplication';
import './menu.css';

const dispose = startExclusiveApplication(createGameApplication);
if (import.meta.hot) import.meta.hot.dispose(dispose);
