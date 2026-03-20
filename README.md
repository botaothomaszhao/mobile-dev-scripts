# mobile-dev-scripts

Tampermonkey scripts that bring developer-tool capabilities (console output, network requests, keyboard events, pointer events) directly onto mobile browsers where F12 is unavailable.

## Scripts

| File | What it does |
|---|---|
| `console-display.user.js` | Displays console messages in an overlay on the page |
| `web-request-list.user.js` | Shows all network requests and their contents, with JSON expansion and request testing |
| `keyboard-event-listener.user.js` | Shows keyboard event parameters on-screen to help debug mobile keyboard behaviour |
| `pointer-event-listener.user.js` | Records and displays all pointer/touch events with pause/resume support |

## How to Use

1. Install the [Tampermonkey](https://www.tampermonkey.net/) browser extension on your mobile browser (or desktop browser for testing). Some browsers support userscripts natively without an extension.
2. Open the Tampermonkey dashboard and create a new script.
3. Copy the contents of the script you want from the `scripts/` folder and paste it into the editor.
4. Save the script. It will run automatically on every page.
5. Open any web page and the overlay panel will appear, showing the relevant debug information. Note that the panel will cover part of the page.

## Notes

All scripts in this repository were created separately by AI.

The scripts and their UI are currently in Chinese. An English version is todo.

## Contributing

PRs are welcome. If you have a script that helps with mobile web development and debugging, feel free to open a pull request.
