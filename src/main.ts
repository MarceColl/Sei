import './style.css'
import typescriptLogo from './typescript.svg'
import viteLogo from '/vite.svg'
import { setupCounter } from './counter.ts'

const uploader = document.getElementById('image_upload');
const json_uploader = document.getElementById('json_upload');
const img_btn = document.getElementById('image_upload_btn');
const json_btn = document.getElementById('json_upload_btn');
img_btn.addEventListener('click', () => {uploader.click();})
json_btn.addEventListener('click', () => {json_uploader.click();})
const cvs = document.getElementById('canvas');
const ctx = cvs.getContext('2d');
ctx.webkitImageSmoothingEnabled = false;
ctx.mozImageSmoothingEnabled = false;
ctx.imageSmoothingEnabled = false;
const displayWidth = cvs.clientWidth;
const displayHeight = cvs.clientHeight;
cvs.width = displayWidth * devicePixelRatio;
cvs.height = displayHeight * devicePixelRatio;
cvs.style.width = `${displayWidth}px`;
cvs.style.height = `${displayHeight}px`;


class Camera {
  constructor(ctx) {
    this.ctx = ctx;
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.button_down = false;

    this.lastmouse = {x: 0, y: 0};
    this.mousedown_pos = {x: 0, y: 0};

    cvs.addEventListener('mousedown', (ev) => {
      this.button_down = true;
      this.mousedown_pos = {x: ev.clientX, y: ev.clientY}
    })

    cvs.addEventListener('mouseup', (ev) => {
      this.button_down = false;

      if (ev.clientX == this.mousedown_pos.x && ev.clientY == this.mousedown_pos.y) {
        // Just a click event, no dragging
        const clickEvent = new CustomEvent('seiclick', {
          detail: this.screenToWorld({
            x: ev.clientX,
            y: ev.clientY,
          })
        });
        document.dispatchEvent(clickEvent);
      }
    })

    cvs.addEventListener('mousemove', (ev) => {
      if (this.button_down) {
        this.x -= (ev.clientX - this.lastmouse.x) / this.zoom * devicePixelRatio;
        this.y -= (ev.clientY - this.lastmouse.y) / this.zoom * devicePixelRatio;
      }

      this.lastmouse.x = ev.clientX;
      this.lastmouse.y = ev.clientY;
    })

    cvs.addEventListener('wheel', (ev) => {
      const is_touchpad = (ev.deltaY == 0 && ev.deltaX == 0) || !Number.isInteger(ev.deltaY) || !Number.isInteger(ev.deltaX);

      // if (ev.ctrlKey) {
      //   const prevMult = this.zoom;
      //   const worldMouse = this.screenToWorld(this.lastmouse);
      //   this.zoom += -ev.deltaY * 0.05;
      //   const ratio = 1 - (prevMult / this.zoom);
      //   this.x += (worldMouse.x - this.x) * ratio;
      //   this.y += (worldMouse.y - this.y) * ratio;
      // } else if (is_touchpad) {
      //   this.x += ev.deltaX / this.zoom * 4;
      //   this.y += ev.deltaY / this.zoom * 4;
      // } else {
        if (ev.deltaY < 0) {
          const prevMult = this.zoom;
          const worldMouse = this.screenToWorld(this.lastmouse);
          this.zoom -= 0.1;
          this.zoom = Math.max(this.zoom, 1);
          const ratio = 1 - (prevMult / this.zoom);
          this.x += (worldMouse.x - this.x) * ratio;
          this.y += (worldMouse.y - this.y) * ratio;
        } else if (ev.deltaY > 0) {
          const prevMult = this.zoom;
          const worldMouse = this.screenToWorld(this.lastmouse);
          this.zoom += 0.1;
          this.zoom = Math.min(this.zoom, 12);
          const ratio = 1 - (prevMult / this.zoom);
          this.x += (worldMouse.x - this.x) * ratio;
          this.y += (worldMouse.y - this.y) * ratio;
        }
      // }

      ev.preventDefault();
    })

    window.addEventListener('resize', () => {
      cvs.width = cvs.clientWidth * devicePixelRatio;
      cvs.height = cvs.clientHeight * devicePixelRatio;
      cvs.style.width = cvs.clientWidth;
      cvs.style.height = cvs.clientHeight;
    })
  }

  screenToWorld(coords) {
    return {
      x: (coords.x * devicePixelRatio) / this.zoom + this.x,
      y: (coords.y * devicePixelRatio) / this.zoom + this.y,
    }
  }

  drawImage(img) {
    this.ctx.drawImage(
      img,
      -this.x * this.zoom,
      -this.y * this.zoom,
      img.width * this.zoom,
      img.height * this.zoom
    );
  }

  drawRect(color, thickness, x, y, w, h) {
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    this.ctx.strokeRect(
      (x - this.x) * this.zoom,
      (y - this.y) * this.zoom ,
      w * this.zoom,
      h * this.zoom
    );
  }

  drawFillRect(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.lineWidth = 0.5;
    this.ctx.fillRect(
      (x - this.x) * this.zoom,
      (y - this.y) * this.zoom ,
      w * this.zoom,
      h * this.zoom
    );
  }

  drawLine(color, x0, y0, x1, y1) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 0.1;
    this.ctx.beginPath();
    ctx.moveTo((x0 - this.x) * this.zoom, (y0 - this.y) * this.zoom);
    ctx.lineTo((x1 - this.x) * this.zoom, (y1 - this.y) * this.zoom);
    ctx.stroke();
  }

  currentMousePos() {
    return this.screenToWorld(this.lastmouse)
  }
}

let spritesheet = null;

class Spritesheet {
  constructor(img) {
    this.img = img;
    this.offset = {x: 0, y: 0};
    this.sprite_size = {x: 16, y: 16};
    this.padding = {x: 0, y: 0};
    this.mappings = {};
    this.names = new Set();
    this.click = null;

    document.getElementById('offset-x').addEventListener('change', (ev) => {this.offset.x = parseInt(ev.target.value);});
    document.getElementById('offset-y').addEventListener('change', (ev) => {this.offset.y = parseInt(ev.target.value);});
    document.getElementById('sprite-x').addEventListener('change', (ev) => {this.sprite_size.x = parseInt(ev.target.value);});
    document.getElementById('sprite-y').addEventListener('change', (ev) => {this.sprite_size.y = parseInt(ev.target.value);});
    document.getElementById('padding-x').addEventListener('change', (ev) => {this.padding.x = parseInt(ev.target.value);});
    document.getElementById('padding-y').addEventListener('change', (ev) => {this.padding.y = parseInt(ev.target.value);});
    document.addEventListener('seiclick', (ev) => {
      this.click = {x: ev.detail.x, y: ev.detail.y};
    })
    document.getElementById('export').addEventListener('click', (ev) => downloadJSON(this.exportJson()));
  }

  draw(camera) {
    camera.drawImage(this.img);
    this.drawLines(camera);
    this.click = null;
  }

  drawLines(camera) {
    const mousePos = camera.currentMousePos();

    const sx = this.sprite_size.x;
    const sy = this.sprite_size.y;

    for (let i = 0; i < 1000; i++) {
      for (let j = 0; j < 1000; j++) {
        const id = `${i};${j}`;
        let x = this.offset.x + (this.padding.x * i) + (this.sprite_size.x * i);
        let y = this.offset.y + (this.padding.y * j) + (this.sprite_size.y * j);

        if (x > this.img.width && y > this.img.height) return;

        if (this.click && this.click.x > x && this.click.x < x + sx && this.click.y > y && this.click.y < y + sy) {
          let name = prompt("Name for this sprite", this.mappings[id]?.name);

          while (this.names.has(name)) {
            name = prompt(`The name ${name} has already been taken. Choose another one`)
          }

          if (name && name.length > 0) {
            this.mappings[id] = {name: name, i: i, j: j, x0: x, y0: y, x1: x + sx, y1: y + sy};
            this.names.add(name);
          }
        }

        if (this.mappings[id]) {
          camera.drawRect('yellow', 3, x, y, sx, sy);
        } else {
          camera.drawRect('red', 0.5, x, y, sx, sy);
        }

        if (mousePos.x > x && mousePos.x < x + sx && mousePos.y > y && mousePos.y < y + sy) {
          camera.drawFillRect('#ff000044', x, y, sx, sy);
        }
      }
    }
  }

  exportJson() {
    let mapping_by_name = {}

    for (const key in this.mappings) {
      const data = this.mappings[key];
      mapping_by_name[data.name] = data;
    }

    return {
      image: getBase64Image(this.img),
      offset: this.offset,
      padding: this.padding,
      spriteSize: this.sprite_size,
      mappings: mapping_by_name,
    };
  }

  importJson(json) {
    this.mappings = {}
    for (const key in json.mappings) {
      const data = json.mappings[key];
      this.mappings[`${data.i};${data.j}`] = data;
    }

    this.offset = json.offset;
    this.padding = json.padding;
    this.sprite_size = json.spriteSize;
    this.img = new Image();
    this.img.src = json.image;

    document.getElementById('offset-x').value = this.offset.x;
    document.getElementById('offset-y').value = this.offset.y;
    document.getElementById('sprite-x').value = this.sprite_size.x;
    document.getElementById('sprite-y').value = this.sprite_size.y;
    document.getElementById('padding-x').value = this.padding.x;
    document.getElementById('padding-y').value = this.padding.y;
  }
}

function getBase64Image(img) {
    var canvas = document.createElement("canvas");
    canvas.width = img.width;
    canvas.height = img.height;

    var ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);

    var dataURL = canvas.toDataURL("image/png");

    return dataURL;
}

function downloadJSON(jsonData, filename = 'spritesheet.json') {
  const jsonString = typeof jsonData === 'object'
    ? JSON.stringify(jsonData, null, 2)
    : jsonData;

  const blob = new Blob([jsonString], { type: 'application/json' });

  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}


const camera = new Camera(ctx);

uploader.addEventListener('change', function(e) {
  const file = e.target.files[0];

  if (file && file.type.match('image.*')) {
    const reader = new FileReader();

    reader.onload = function(event) {
      const img = new Image();
      img.onload = function() {
        // Clear the canvas
        ctx.clearRect(0, 0, cvs.width, cvs.height);

        spritesheet = new Spritesheet(img);
        window.spritesheet = spritesheet;
      };

      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  } else {
    alert('Please select a valid image file');
  }
});


json_uploader.addEventListener('change', (e) => {
  const file = e.target.files[0];

  if (file) {
    const reader = new FileReader();
    reader.onload = function(event) {
      try {
        const jsonData = JSON.parse(event.target.result);
        console.log('Parsed JSON data:', jsonData);

        const image = new Image();
        image.src = jsonData.image;
        spritesheet = new Spritesheet(image);
        spritesheet.importJson(jsonData);
      } catch (error) {
        console.error('Error parsing JSON:', error);
      }
    };

    reader.onerror = function(event) {
      console.error('Error reading file:', reader.error);
    };

    reader.readAsText(file);
  }
})


function tick() {
  ctx.clearRect(0, 0, cvs.width, cvs.height);

  if (spritesheet) {
    spritesheet.draw(camera);
  }

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
