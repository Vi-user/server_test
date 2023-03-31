const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const multer  = require('multer');
const sizeOf = require('image-size');

const PORT = 8000;

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const ALLOWED_WIDTH = 1920;
const ALLOWED_HEIGHT = 1080;

const app = express();
app.use(cors());
app.use(express.static('upload'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'upload/')
  },
  filename: function (req, file, cb) {
    cb(null, `${Date.now()}_${file.originalname}`)
  }
})

function fileFilter (req, file, cb) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    req.fileValidationError = 'Forbidden extension, only images are allowed';
    return cb(null, false, req.fileValidationError);
  }
  cb(null, true);
}

app.use(multer({storage, fileFilter}).single('image'));
app.get('/', (req, res) => {
  res.send('GET request to the homepage')
})

app.post('/images', async function (req, res, next) {
  if (req.fileValidationError)
    res.status(404).send(req.fileValidationError);
  try {
    const dimension = await sizeOf(req.file.path)
    if (dimension.width !== ALLOWED_WIDTH || dimension.height !== ALLOWED_HEIGHT) {
      await fs.unlink(path.join(__dirname, req.file.path))
      console.log('dimension')
      res.status(404).send({message: 'The dimensions of the images should be  1920 * 1080', fileName: req.file.filename});
    } else {
      res.status(201).send({message: 'File was successfully upload', fileName: req.file.filename});
    }
  } catch (e) {
    console.log('post image error', e)
  }
});

async function sortedImages(dirname) {
  try {
    const files = await fs.readdir(dirname);
    const filesData = files
      .map(fileName => ({
        name: fileName,
        time: fsSync.statSync(`${dirname}/${fileName}`).ctimeMs,
      }))
      .sort((a, b) => a.time - b.time)
      .map(file => file.name);
    return filesData;
  } catch (e) {
    console.error('sortedImg e', e);
  }
}

app.get('/images', function (req, res) {
  const pathToUploadFolder = path.join(__dirname, 'upload');
  sortedImages(pathToUploadFolder)
  .then(result => res.status(200).send({'imagesList': result}))
  .catch(e => res.status(400).send({'message': e.message}));
})


async function clearDir(folder) {
  try {
    const files = await fs.readdir(folder);
    if (!files.length) return;
    const deleteFiles = files.map(file => fs.unlink(path.join(folder, file)))
    return Promise.all(deleteFiles)
      .then((res) => res.every(el => el === undefined))
      .catch(e => e);
  } catch (e) {
    console.error('clearDir e', e);
  }
}

app.delete('/images', async (req, res) => {
  const result = await clearDir(path.join(__dirname, 'upload'));
  console.log('result', result)
  if (result) {
    res.status(200).send('Images were successfully deleted');
    // res.status(204).send('Images were successfully deleted'); // express response objects will not forward a response body if the response status code is 204 No Content.
  } else {
    res.status(404).send('The folder is already empty');
  }
})

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
