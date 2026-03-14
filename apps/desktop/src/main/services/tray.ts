import { Menu, Tray, nativeImage } from 'electron';

export interface TrayController {
  setStatusLabel: (statusLabel: string) => void;
  destroy: () => void;
}

export interface TrayControllerOptions {
  iconPath: string;
  onShowWindow: () => void;
  onPickProject: () => void | Promise<void>;
  onQuit: () => void;
}

export function createTrayController(options: TrayControllerOptions): TrayController {
  const icon = nativeImage.createFromPath(options.iconPath);
  const tray = new Tray(icon);
  tray.setToolTip('Spec Workflow Desktop');

  let statusLabel = 'Status: Ready';

  const updateMenu = () => {
    tray.setContextMenu(Menu.buildFromTemplate([
      {
        label: 'Open desktop',
        click: options.onShowWindow
      },
      {
        label: 'Add project',
        click: () => {
          void options.onPickProject();
        }
      },
      {
        label: statusLabel,
        enabled: false
      },
      {
        type: 'separator'
      },
      {
        label: 'Quit',
        click: options.onQuit
      }
    ]));
  };

  tray.on('double-click', options.onShowWindow);
  updateMenu();

  return {
    setStatusLabel(nextStatusLabel) {
      statusLabel = nextStatusLabel;
      updateMenu();
    },
    destroy() {
      tray.destroy();
    }
  };
}
