const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');
const pool = require('./db'); // Импортируем конфигурацию базы данных
const multer = require('multer');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware для разбора JSON и URL-encoded данных
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors());

// Настройка сервера для использования EJS шаблонов и статических файлов
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware для обработки мультипарт запросов с использованием Multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Указываем папку, куда сохранять файлы
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя для файла, сохраняем оригинальное расширение
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage: storage });

// Обработчик POST запроса для загрузки изображений
app.post('/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).send('No files were uploaded.');
    }
    // В req.file содержится информация о загруженном файле
    console.log('Uploaded file:', req.file);

    // Возвращаем URL загруженного изображения для дальнейшего использования
    const imageUrl = `http://85.159.226.160:${port}/uploads/${req.file.filename}`;
    res.json({ url: imageUrl });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).send('Error uploading file');
  }
});

// Middleware для обслуживания статических файлов из папки uploads
app.use('/uploads', express.static('uploads'));

// Пример пользователей для проверки логина и пароля (обычно используются базы данных)
const users = [
    { username: 'Admin', password: 'Artyom08' }
];

// POST-запрос для обработки данных регистрации
app.post('/register', async (req, res) => {
    const { username, password } = req.body;

    // Проверка наличия пользователя в списке
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
        // Если пользователь найден, перенаправляем на страницу логов
        res.redirect('/logs');
    } else {
        // Если пользователь не найден, возвращаем к форме регистрации с сообщением об ошибке
        res.render('register', { errorMessage: 'Invalid username or password. Please try again.' });
    }
});

// POST-запрос для сохранения логов регистрации
app.post('/log-registration', async (req, res) => {
    const { id, email, name, given_name, family_name, picture } = req.body;
    console.log('Received registration log:', req.body);

    try {
        // Проверка существования записи
        const [rows] = await pool.query('SELECT * FROM registration_logs WHERE id = ?', [id]);

        if (rows.length > 0) {
            console.log('Registration log already exists in the database.');
            res.send('Registration log already exists');
            return;
        }

        // Вставка данных в таблицу
        await pool.query(
            'INSERT INTO registration_logs (id, email, name, given_name, family_name, picture) VALUES (?, ?, ?, ?, ?, ?)',
            [id, email, name, given_name, family_name, picture]
        );

        // Чтение текущего содержимого файла
        const filePath = path.join(__dirname, 'registrationLogs.txt');
        const content = await fs.readFile(filePath, 'utf-8');

        // Проверка наличия такого же лога в файле
        if (content.includes(JSON.stringify(req.body))) {
            console.log('Registration log already exists in the file.');
            res.send('Registration log already exists');
            return;
        }

        // Запись в файл registrationLogs.txt
        await fs.appendFile(filePath, JSON.stringify(req.body) + '\n');

        res.send('Registration log received');
    } catch (error) {
        console.error('Error saving registration log:', error);
        res.status(500).send('Server error');
    }
});

// GET-запрос для отображения логов регистрации пользователей
app.get('/logs', async (req, res) => {
    try {
        // Чтение логов из базы данных
        const [rows] = await pool.query('SELECT * FROM registration_logs');

        // Преобразование содержимого базы данных в массив пользователей
        const users = rows;

        // Отображение списка пользователей на странице логов
        res.render('logs', { users });
    } catch (error) {
        console.error('Error reading from database:', error);
        res.status(500).send('Error reading from database');
    }
});

// GET-запрос для получения данных из базы данных
app.get('/fetch-db', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM registration_logs');
        res.json({ users: rows });
    } catch (error) {
        console.error('Error fetching data from database:', error);
        res.status(500).send('Error fetching data from database');
    }
});

app.post('/save-payment-method', async (req, res) => {
    const { userId, paymentMethodId } = req.body;
    
    try {
      // Update the user record with the payment method ID
      await pool.query(
        'UPDATE registration_logs SET payment_methods = ? WHERE id = ?',
        [paymentMethodId, userId]
      );
  
      // Increase the user's coins by 10 after successful payment
      const [userRows] = await pool.query('SELECT * FROM registration_logs WHERE id = ?', [userId]);
      if (userRows.length > 0) {
        const currentCoins = userRows[0].coins || 0; // Default to 0 if coins are null
        const newCoins = currentCoins + 10; // Increase coins by 10
        await pool.query('UPDATE registration_logs SET coins = ? WHERE id = ?', [newCoins, userId]);
      } else {
        throw new Error('User not found');
      }
  
      res.send('Payment method ID saved successfully and coins updated');
    } catch (error) {
      console.error('Error saving payment method ID or updating coins:', error);
      res.status(500).send('Server error');
    }
  });

  app.post('/create-post', async (req, res) => {
    const { text, image, likes, dislikes, author } = req.body;
  
    try {
      // Вставка данных в таблицу постов
      await pool.query(
        'INSERT INTO posts (text, image, likes, dislikes, author_name, author_email, author_picture) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [text, image, likes, dislikes, author.name, author.email, author.picture]
      );
  
      res.send('Post created successfully');
    } catch (error) {
      console.error('Error creating post:', error);
      res.status(500).send('Server error');
    }
  });

  // Добавьте этот код в ваш файл сервера (например, server.js или app.js)

app.get('/posts', async (req, res) => {
    try {
      const [rows] = await pool.query('SELECT * FROM posts');
      res.json(rows);
    } catch (error) {
      console.error('Error fetching posts:', error);
      res.status(500).send('Server error');
    }
  });

app.post('/posts/:postId/like', async (req, res) => {
  const { postId } = req.params;
  try {
    // Выполнение запроса к базе данных для обновления лайков
    await pool.query('UPDATE posts SET likes = likes + 1 WHERE id = ?', [postId]);
    
    // Получение обновленного списка постов
    const updatedPosts = await pool.query('SELECT * FROM posts');
    res.json(updatedPosts);
  } catch (error) {
    console.error('Error updating likes:', error);
    res.status(500).send('Server error');
  }
});

// Обработчик POST запроса для дизлайка поста
app.post('/posts/:postId/dislike', async (req, res) => {
    const { postId } = req.params;
    try {
      // Выполнение запроса к базе данных для обновления дизлайков
      await pool.query('UPDATE posts SET dislikes = dislikes + 1 WHERE id = ?', [postId]);
      
      // Получение обновленного списка постов
      const updatedPosts = await pool.query('SELECT * FROM posts');
      res.json(updatedPosts);
    } catch (error) {
      console.error('Error updating dislikes:', error);
      res.status(500).send('Server error');
    }
  });

// Добавляем эндпоинт для получения удаленных постов
app.get('/deleted-posts', async (req, res) => {
    try {
        // Запрос к базе данных для получения удаленных постов
        const [rows] = await pool.query('SELECT * FROM deleted_posts_log');
        res.json(rows);
    } catch (error) {
        console.error('Error fetching deleted posts:', error);
        res.status(500).send('Server error');
    }
});

// Эндпоинт для удаления поста
app.delete('/posts/:postId', async (req, res) => {
    const { postId } = req.params;
    const { reason } = req.body;

    try {
        // Получаем данные поста, который собираемся удалить
        const [post] = await pool.query('SELECT * FROM posts WHERE id = ?', [postId]);

        // Если пост найден, добавляем его в таблицу удаленных постов
        if (post.length > 0) {
            const { text, image, author_name, author_email } = post[0];
            await pool.query(
                'INSERT INTO deleted_posts_log (author_name, author_email, post_text, post_image, reason) VALUES (?, ?, ?, ?, ?)',
                [author_name, author_email, text, image, reason]
            );

            // Удаляем пост из основной таблицы
            await pool.query('DELETE FROM posts WHERE id = ?', [postId]);
            res.send('Post deleted and logged successfully');
        } else {
            res.status(404).send('Post not found');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        res.status(500).send('Server error');
    }
});

// GET запрос для получения количества коинов пользователя
app.get('/coins/:userId', async (req, res) => {
    const { userId } = req.params;
    try {
        const [rows] = await pool.query('SELECT coins FROM registration_logs WHERE id = ?', [userId]);
        if (rows.length > 0) {
            res.json({ coins: rows[0].coins });
        } else {
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error fetching coins:', error);
        res.status(500).send('Server error');
    }
});

// POST запрос для обновления количества коинов пользователя
app.post('/coins/:userId', async (req, res) => {
    const { userId } = req.params;  // Extract userId from URL parameters
    const { coins } = req.body;     // Extract coins from request body

    try {
        await pool.query('UPDATE registration_logs SET coins = ? WHERE id = ?', [coins, userId]);
        res.send('Coins updated successfully');
    } catch (error) {
        console.error('Error updating coins:', error);
        res.status(500).send('Server error');
    }
});

// Запуск сервера
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});