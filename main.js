const electron = require('electron')
const path = require('path')
const url = require('url')
// Module to control application life.
const app = electron.app
const ipcMain = electron.ipcMain
const Menu = electron.Menu
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow

console.log(process.versions)

const template = [
	{
		label: 'File',
		submenu: [
			{
				label: 'New',
				accelerator: 'CmdOrCtrl+N',
				click () {
					openWindow("")
				}
			},
			{
				label: 'Open',
				accelerator: 'CmdOrCtrl+O',
				click () {
					electron.dialog.showOpenDialog({
						properties: ['openFile'],
						filters: [
					    {name: 'Edge', extensions: ['edge']},
					  ],
					},function(ps){
						if (!ps) return
						openWindow(ps[0])
					})
				}
			},
			{type: 'separator'},
			{
				label: 'Save',
				accelerator: 'CmdOrCtrl+S',
				click () {
					sendCmd("save")
				}
			},
			{
				label: 'Save As...',
				accelerator: 'Shift+CmdOrCtrl+S',
				click () {
					sendCmd("saveAs")
				}
			},
		]
	},
	{
		label: 'Edit',
		submenu: [
			{
				label: 'Undo',
				accelerator: 'CmdOrCtrl+Z',
				click (menuItem,win) {
					win.webContents.undo()
					sendCmd("undo")
				}
			},
			{
				label: 'Redo',
				accelerator: 'Shift+CmdOrCtrl+Z',
				click (menuItem,win) {
					win.webContents.redo()
					sendCmd("redo")
				}
			},
			{type: 'separator'},
			{
				label: 'Cut',
				role:"cut",
				accelerator: 'CmdOrCtrl+X',
				click (menuItem,win) {
					win.webContents.cut()
					sendCmd("cut")
				}
			},
			{
				label: 'Copy',
				role:"copy",
				accelerator: 'CmdOrCtrl+C',
				click (menuItem,win) {
					win.webContents.copy()
					sendCmd("copy")
				}
			},
			{
				label: 'Paste',
				role:"paste",
				accelerator: 'CmdOrCtrl+V',
				click (menuItem,win) {
					win.webContents.paste()
					sendCmd("paste")
				}
			},
			{
				label: 'Paste And Match Style',
				accelerator: 'Shift+CmdOrCtrl+V',
				click (menuItem,win) {
					win.webContents.pasteAndMatchStyle()
					sendCmd("pasteAndMatchStyle")
				}
			},
			{
				label: 'Delete',
				accelerator: 'Backspace',
				click (menuItem,win) {
					win.webContents.delete()
					sendCmd("del")
				}
			},
			{type: 'separator'},
			{
				label: 'New Vertex',
				accelerator: 'CmdOrCtrl+T',
				click () {
					sendCmd("newVert")
				}
			},
			{
				label: 'New Vertex (Reverse)',
				accelerator: 'Shift+CmdOrCtrl+T',
				click () {
					sendCmd("newVertR")
				}
			},
			{
				label: 'New Edge',
				accelerator: 'CmdOrCtrl+E',
				click () {
					sendCmd("newEdge")
				}
			},
			{
				label: 'New Edge (Reverse)',
				accelerator: 'Shift+CmdOrCtrl+E',
				click () {
					sendCmd("newEdgeR")
				}
			},
			{
				label: 'Graph Directed/Undirected',
				accelerator: 'CmdOrCtrl+Alt+E',
				click () {
					sendCmd("graphDirMode")
				}
			},
			{
				label: 'Edge Direction',
				accelerator: 'Alt+E',
				click () {
					sendCmd("edgeDir")
				}
			},
			{
				label: 'Rename',
				accelerator: 'CmdOrCtrl+Enter',
				click () {
					sendCmd("rename")
				}
			},
			{
        label: 'Color',
        submenu: [
					{
						label: 'Customize Colors',
						accelerator: 'Shift+Alt+C',
						click () {
							sendCmd("customizeColors")
						}
					},
					{
						label: 'Switch Color',
						accelerator: 'Alt+C',
						click () {
							sendCmd("switchColor")
						}
					},
					{type: 'separator'},
					{
						label: 'Color 0',
						accelerator: 'Alt+0',
						click () {
							sendCmd("color0")
						}
					},
          {
						label: 'Color 1',
						accelerator: 'Alt+1',
						click () {
							sendCmd("color1")
						}
					},
					{
						label: 'Color 2',
						accelerator: 'Alt+2',
						click () {
							sendCmd("color2")
						}
					},
					{
						label: 'Color 3',
						accelerator: 'Alt+3',
						click () {
							sendCmd("color3")
						}
					},
					{
						label: 'Color 4',
						accelerator: 'Alt+4',
						click () {
							sendCmd("color4")
						}
					},
					{
						label: 'Color 5',
						accelerator: 'Alt+5',
						click () {
							sendCmd("color5")
						}
					},
					{
						label: 'Color 6',
						accelerator: 'Alt+6',
						click () {
							sendCmd("color6")
						}
					},
					{
						label: 'Color 7',
						accelerator: 'Alt+7',
						click () {
							sendCmd("color7")
						}
					},
					{
						label: 'Color 8',
						accelerator: 'Alt+8',
						click () {
							sendCmd("color8")
						}
					},
					{
						label: 'Color 9',
						accelerator: 'Alt+9',
						click () {
							sendCmd("color9")
						}
					}
        ]
      }
		]
	},
	{
		label: 'View',
		submenu: [
			{role: 'reload'},
			{role: 'forcereload'},
			{role: 'toggledevtools'},
			{type: 'separator'},
			{
				label: 'Auto Layout Pause/Resume',
				accelerator: 'CmdOrCtrl+P',
				click () {
					sendCmd("autoLayout")
				}
			},
			{
				label: 'Show/Hide Vertex',
				accelerator: 'CmdOrCtrl+D',
				click () {
					sendCmd("showOrHideVert")
				}
			},
			{
				label: 'Show Vertex Alone',
				accelerator: 'Shift+CmdOrCtrl+D',
				click () {
					sendCmd("showVertAlone")
				}
			},
			{
				label: 'Switch Adjacent Display',
				accelerator: 'Shift+Alt+D',
				click () {
					sendCmd("displayAdjacent")
				}
			},
			{
				label: 'Find Vertex',
				accelerator: 'CmdOrCtrl+F',
				click () {
					sendCmd("findVert")
				}
			},
			{
				label: 'History Panel',
				accelerator: 'Shift+CmdOrCtrl+H',
				click () {
					sendCmd("switchHistoryPanel")
				}
			},
			{type: 'separator'},
			{
				label: 'Reset Viewport',
				click () {
					sendCmd("resetZoom")
				}
			},
			{
				label: 'Zoom In',
				accelerator: 'CmdOrCtrl+Plus',
				click () {
					sendCmd("zoomin")
				}
			},
			{
				label: 'Zoom Out',
				accelerator: 'CmdOrCtrl+-',
				click () {
					sendCmd("zoomout")
				}
			},
			{type: 'separator'},
			{role: 'togglefullscreen'}
		]
	},
	{
		label: 'Selection',
		submenu: [
			{
				label: 'Select All',
				accelerator: 'Alt+A',
				click (menuItem,win) {
					sendCmd("selectAll")
				}
			},
			{
				label: 'Unselect',
				accelerator: 'Shift+Alt+A',
				click (menuItem,win) {
					sendCmd("unselect")
				}
			},{
				label: 'Switch Selection (Outset)',
				accelerator: 'Alt+S',
				click (menuItem,win) {
					sendCmd("switchSelectionOutset")
				}
			},
			{
				label: 'Switch Selection (Inset)',
				accelerator: 'Shift+Alt+S',
				click (menuItem,win) {
					sendCmd("switchSelectionInset")
				}
			},
		]
	},
	{
		role: 'window',
		submenu: [
			{role: 'minimize'},
			{role: 'close'}
		]
	},
	{
		role: 'help',
		submenu: [
			{
				label: 'Learn More',
				click () { require('electron').shell.openExternal('https://electron.atom.io') }
			}
		]
	}
]

if (process.platform === 'darwin') {
	template.unshift({
		label: app.getName(),
		submenu: [
			{role: 'about'},
			{type: 'separator'},
			{role: 'services', submenu: []},
			{type: 'separator'},
			{role: 'hide'},
			{role: 'hideothers'},
			{role: 'unhide'},
			{type: 'separator'},
			{role: 'quit'}
		]
	})

	// Edit menu
	template[2].submenu.push(
		{type: 'separator'},
		{
			label: 'Speech',
			submenu: [
				{role: 'startspeaking'},
				{role: 'stopspeaking'}
			]
		}
	)

	// Window menu
	template[5].submenu = [
		{role: 'close'},
		{role: 'minimize'},
		{role: 'zoom'},
		{type: 'separator'},
		{role: 'front'}
	]
}

app.on('ready', function() {
	const menu = Menu.buildFromTemplate(template)
	Menu.setApplicationMenu(menu)
	openWindow("")

	ipcMain.on('showSaveDialog', (event, p) => {
		electron.dialog.showSaveDialog({
			defaultPath:p||"",
			filters: [
		    {name: 'Edge', extensions: ['edge']},
		  ],
		},function(ps){
			if (!ps){
				event.returnValue = ""
			}else{
				event.returnValue = ps
			}
		})
	})
})

function openWindow(p){
	// Create the browser window.
  let win = new BrowserWindow({
		width: 1300,
		height: 820,
		title:p||"",
	})

  // and load the index.html of the app.
  win.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
		search:'path='+(p||''),
    slashes: true
  }))

  // Open the DevTools.
	//win.webContents.openDevTools()

  // Emitted when the window is closed.
  win.on('closed', function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
  })

	return win
}

function sendCmd(cmd){
	let win = BrowserWindow.getFocusedWindow()
	if (!win) return
	win.webContents.send("cmd",cmd)
}
