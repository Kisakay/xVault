import './index.css';
import { XVaultApp } from './app';

const root = document.getElementById('root');

if (!root) {
  throw new Error('Unable to mount xVault: missing #root element.');
}

new XVaultApp(root);
