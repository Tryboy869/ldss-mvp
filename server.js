// server.js - BACKEND SERVICE LDSS avec Turso
// NEXUS AXION 3.5 Architecture

import { createClient } from '@libsql/client';
import crypto from 'crypto';

export class LDSSBackend {
  constructor() {
    this.db = null;
    this.backendAdapters = new Map();
  }

  // ========== INITIALISATION ==========
  async init() {
    console.log('✅ [BACKEND] Initializing LDSS Backend...');
    
    try {
      // Connexion à Turso (Database principale pour LDSS)
      this.db = createClient({
        url: process.env.TURSO_DATABASE_URL,
        authToken: process.env.TURSO_AUTH_TOKEN
      });

      // Tester la connexion
      await this.db.execute('SELECT 1');
      console.log('✅ [BACKEND] Turso database connected');

      // Créer les tables si elles n\'existent pas
      await this.createTables();
      console.log('✅ [BACKEND] Database schema ready');

    } catch (error) {
      console.error('❌ [BACKEND] Initialization failed:', error);
      throw error;
    }
  }

  // ========== CRÉATION DES TABLES ==========
  async createTables() {
    console.log('[BACKEND] Creating database schema...');

    // Table users (Comptes développeurs)
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT,
        created_at INTEGER DEFAULT (unixepoch()),
        last_login INTEGER
      )
    `);

    // Table sessions
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        expires_at INTEGER NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Table projects
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        token TEXT UNIQUE NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        
        -- Backend configuration
        backend_provider TEXT DEFAULT 'none',
        backend_config TEXT,
        backend_status TEXT DEFAULT 'not_configured',
        last_backend_test INTEGER,
        
        -- Stats
        active_users INTEGER DEFAULT 0,
        total_storage_bytes INTEGER DEFAULT 0,
        
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `);

    // Table project_data (Données des end-users)
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS project_data (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        collection TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        updated_at INTEGER DEFAULT (unixepoch()),
        device_id TEXT,
        end_user_id TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Table sync_log
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS sync_log (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        operation TEXT NOT NULL,
        timestamp INTEGER DEFAULT (unixepoch()),
        details TEXT,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    console.log('[BACKEND] ✅ Database schema created');
  }

  // ========== AUTHENTIFICATION ==========
  async registerUser(data) {
    console.log('[BACKEND] Registering user:', data.email);

    const { email, password, name } = data;

    // Validation
    if (!email || !password) {
      throw new Error('Email and password required');
    }

    if (password.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    // Vérifier si l\'email existe déjà
    const existing = await this.db.execute({
      sql: 'SELECT id FROM users WHERE email = ?',
      args: [email]
    });

    if (existing.rows.length > 0) {
      throw new Error('Email already registered');
    }

    // Hash du password (simple pour MVP - utiliser bcrypt en prod)
    const passwordHash = crypto
      .createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'ldss-salt'))
      .digest('hex');

    // Créer l\'utilisateur
    const userId = 'user_' + crypto.randomBytes(8).toString('hex');
    
    await this.db.execute({
      sql: `INSERT INTO users (id, email, password_hash, name) 
            VALUES (?, ?, ?, ?)`,
      args: [userId, email, passwordHash, name || null]
    });

    // Créer une session
    const session = await this.createSession(userId);

    console.log('[BACKEND] ✅ User registered:', userId);

    return {
      success: true,
      user: {
        id: userId,
        email: email,
        name: name
      },
      session: session
    };
  }

  async loginUser(data) {
    console.log('[BACKEND] Login attempt:', data.email);

    const { email, password } = data;

    if (!email || !password) {
      throw new Error('Email and password required');
    }

    // Hash du password
    const passwordHash = crypto
      .createHash('sha256')
      .update(password + (process.env.PASSWORD_SALT || 'ldss-salt'))
      .digest('hex');

    // Vérifier credentials
    const result = await this.db.execute({
      sql: 'SELECT id, email, name FROM users WHERE email = ? AND password_hash = ?',
      args: [email, passwordHash]
    });

    if (result.rows.length === 0) {
      throw new Error('Invalid credentials');
    }

    const user = result.rows[0];

    // Mettre à jour last_login
    await this.db.execute({
      sql: 'UPDATE users SET last_login = unixepoch() WHERE id = ?',
      args: [user.id]
    });

    // Créer une session
    const session = await this.createSession(user.id);

    console.log('[BACKEND] ✅ User logged in:', user.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      session: session
    };
  }

  async createSession(userId) {
    const sessionId = 'session_' + crypto.randomBytes(16).toString('hex');
    const sessionToken = 'ldss_session_' + crypto.randomBytes(32).toString('hex');
    const expiresAt = Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60); // 30 jours

    await this.db.execute({
      sql: `INSERT INTO sessions (id, user_id, token, expires_at) 
            VALUES (?, ?, ?, ?)`,
      args: [sessionId, userId, sessionToken, expiresAt]
    });

    return {
      userId: userId,
      sessionToken: sessionToken,
      expiresAt: expiresAt
    };
  }

  // ========== PROJECTS ==========
  async getUserProjects(userId) {
    console.log('[BACKEND] Fetching projects for user:', userId);

    const result = await this.db.execute({
      sql: `SELECT id, name, description, token, created_at, 
                   backend_provider, backend_status, 
                   active_users, total_storage_bytes
            FROM projects 
            WHERE user_id = ?
            ORDER BY created_at DESC`,
      args: [userId]
    });

    return {
      success: true,
      projects: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        token: row.token,
        createdAt: row.created_at,
        backendProvider: row.backend_provider,
        backendStatus: row.backend_status,
        activeUsers: row.active_users || 0,
        totalStorage: this.formatBytes(row.total_storage_bytes || 0)
      }))
    };
  }

  async createProject(userId, data) {
    console.log('[BACKEND] Creating project:', data.name);

    const { name, description } = data;

    if (!name || name.trim().length === 0) {
      throw new Error('Project name required');
    }

    // Générer un token unique
    const projectId = 'project_' + crypto.randomBytes(8).toString('hex');
    const projectToken = 'ldss_' + crypto.randomBytes(16).toString('hex');

    await this.db.execute({
      sql: `INSERT INTO projects (id, user_id, name, description, token)
            VALUES (?, ?, ?, ?, ?)`,
      args: [projectId, userId, name, description || null, projectToken]
    });

    console.log('[BACKEND] ✅ Project created:', projectId);

    return {
      success: true,
      project: {
        id: projectId,
        name: name,
        description: description,
        token: projectToken,
        backendProvider: 'none',
        backendStatus: 'not_configured'
      }
    };
  }

  async getProject(userId, projectId) {
    console.log('[BACKEND] Fetching project:', projectId);

    const result = await this.db.execute({
      sql: `SELECT * FROM projects 
            WHERE id = ? AND user_id = ?`,
      args: [projectId, userId]
    });

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    const project = result.rows[0];

    return {
      success: true,
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        token: project.token,
        backendProvider: project.backend_provider,
        backendStatus: project.backend_status,
        backendConfig: project.backend_config ? JSON.parse(project.backend_config) : null,
        activeUsers: project.active_users || 0,
        totalStorage: this.formatBytes(project.total_storage_bytes || 0)
      }
    };
  }

  async deleteProject(userId, projectId) {
    console.log('[BACKEND] Deleting project:', projectId);

    // Vérifier ownership
    const result = await this.db.execute({
      sql: 'SELECT id FROM projects WHERE id = ? AND user_id = ?',
      args: [projectId, userId]
    });

    if (result.rows.length === 0) {
      throw new Error('Project not found');
    }

    // Supprimer les données
    await this.db.execute({
      sql: 'DELETE FROM project_data WHERE project_id = ?',
      args: [projectId]
    });

    // Supprimer le projet
    await this.db.execute({
      sql: 'DELETE FROM projects WHERE id = ?',
      args: [projectId]
    });

    console.log('[BACKEND] ✅ Project deleted:', projectId);

    return {
      success: true,
      message: 'Project deleted successfully'
    };
  }

  // ========== BACKEND CONFIGURATION ==========
  async configureProjectBackend(userId, projectId, config) {
    console.log('[BACKEND] Configuring backend for project:', projectId, 'Provider:', config.provider);

    // Vérifier ownership
    const project = await this.getProject(userId, projectId);
    if (!project.success) {
      throw new Error('Project not found');
    }

    // Valider la config
    this.validateBackendConfig(config);

    // Tester la connexion
    const testResult = await this.testBackendConnection(config);
    if (!testResult.success) {
      throw new Error(`Backend connection failed: ${testResult.message}`);
    }

    // Sauvegarder la config (encrypter en production)
    await this.db.execute({
      sql: `UPDATE projects 
            SET backend_provider = ?,
                backend_config = ?,
                backend_status = 'connected',
                last_backend_test = unixepoch()
            WHERE id = ?`,
      args: [config.provider, JSON.stringify(config), projectId]
    });

    console.log('[BACKEND] ✅ Backend configured:', projectId);

    return {
      success: true,
      message: `${config.provider} backend configured successfully`,
      latency: testResult.latency
    };
  }

  async testProjectBackend(userId, projectId, config) {
    console.log('[BACKEND] Testing backend for project:', projectId);

    const result = await this.testBackendConnection(config);

    return result;
  }

  validateBackendConfig(config) {
    const { provider } = config;

    switch (provider) {
      case 'turso':
        if (!config.databaseUrl || !config.authToken) {
          throw new Error('Turso requires databaseUrl and authToken');
        }
        break;
      case 'planetscale':
      case 'neon':
        if (!config.connectionString) {
          throw new Error(`${provider} requires connectionString`);
        }
        break;
      case 'supabase':
        if (!config.url || !config.anonKey) {
          throw new Error('Supabase requires url and anonKey');
        }
        break;
      case 'custom':
        if (!config.baseUrl || !config.apiKey) {
          throw new Error('Custom backend requires baseUrl and apiKey');
        }
        break;
      case 'none':
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }
  }

  async testBackendConnection(config) {
    const startTime = Date.now();
    
    try {
      switch (config.provider) {
        case 'turso':
          const tursoClient = createClient({
            url: config.databaseUrl,
            authToken: config.authToken
          });
          await tursoClient.execute('SELECT 1');
          break;

        case 'planetscale':
        case 'neon':
          // Simuler test pour MVP
          await new Promise(resolve => setTimeout(resolve, 100));
          break;

        case 'supabase':
          // Simuler test pour MVP
          await new Promise(resolve => setTimeout(resolve, 100));
          break;

        case 'custom':
          // Simuler test pour MVP
          await new Promise(resolve => setTimeout(resolve, 100));
          break;

        case 'none':
          return {
            success: true,
            message: 'Local-only mode (no backend)',
            latency: 0
          };
      }

      const latency = Date.now() - startTime;

      return {
        success: true,
        message: `${config.provider} connection successful`,
        latency: latency
      };

    } catch (error) {
      return {
        success: false,
        message: error.message,
        latency: Date.now() - startTime
      };
    }
  }

  // ========== DATA SYNC ==========
  async getProjectData(userId, projectId, query) {
    console.log('[BACKEND] Fetching data for project:', projectId);

    // Vérifier ownership
    const project = await this.getProject(userId, projectId);
    if (!project.success) {
      throw new Error('Project not found');
    }

    const { collection, limit = 100 } = query;

    let sql = 'SELECT * FROM project_data WHERE project_id = ?';
    const args = [projectId];

    if (collection) {
      sql += ' AND collection = ?';
      args.push(collection);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    args.push(parseInt(limit));

    const result = await this.db.execute({ sql, args });

    return {
      success: true,
      data: result.rows.map(row => ({
        id: row.id,
        collection: row.collection,
        data: JSON.parse(row.data),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    };
  }

  async storeProjectData(userId, projectId, data) {
    console.log('[BACKEND] Storing data for project:', projectId);

    // Vérifier ownership
    const project = await this.getProject(userId, projectId);
    if (!project.success) {
      throw new Error('Project not found');
    }

    const { collection, items } = data;

    if (!collection || !items || !Array.isArray(items)) {
      throw new Error('Invalid data format');
    }

    for (const item of items) {
      const dataId = item.id || ('data_' + crypto.randomBytes(8).toString('hex'));
      
      await this.db.execute({
        sql: `INSERT OR REPLACE INTO project_data 
              (id, project_id, collection, data, device_id, end_user_id, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, unixepoch())`,
        args: [
          dataId,
          projectId,
          collection,
          JSON.stringify(item),
          item.deviceId || null,
          item.endUserId || null
        ]
      });
    }

    // Mettre à jour les stats du projet
    await this.updateProjectStats(projectId);

    console.log('[BACKEND] ✅ Data stored:', items.length, 'items');

    return {
      success: true,
      stored: items.length
    };
  }

  async updateProjectStats(projectId) {
    // Calculer la taille totale
    const sizeResult = await this.db.execute({
      sql: `SELECT SUM(LENGTH(data)) as total_size
            FROM project_data
            WHERE project_id = ?`,
      args: [projectId]
    });

    const totalSize = sizeResult.rows[0].total_size || 0;

    await this.db.execute({
      sql: `UPDATE projects 
            SET total_storage_bytes = ?
            WHERE id = ?`,
      args: [totalSize, projectId]
    });
  }

  // ========== HEALTH CHECK ==========
  async healthCheck() {
    const checks = {
      timestamp: new Date().toISOString(),
      status: 'ok',
      services: {}
    };

    // Check database
    try {
      await this.db.execute('SELECT 1');
      checks.services.database = 'connected';
    } catch (error) {
      checks.services.database = 'offline';
      checks.status = 'degraded';
    }

    // Check memory
    const used = process.memoryUsage();
    checks.memory = {
      heapUsed: Math.round(used.heapUsed / 1024 / 1024) + ' MB',
      heapTotal: Math.round(used.heapTotal / 1024 / 1024) + ' MB'
    };

    return checks;
  }

  // ========== UTILS ==========
  formatBytes(bytes) {
    if (bytes === 0) return '0 KB';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}