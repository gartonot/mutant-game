import { createGameApplication } from '@/app/GameApplication';
import './menu.css';

const dispose = createGameApplication();
if (import.meta.hot) import.meta.hot.dispose(dispose);
