const Joi = require('joi');

/**
 * Validation middleware wrapper
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));
      
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }
    
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // Auth schemas
  adminLogin: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(6).required().messages({
      'string.min': 'Password must be at least 6 characters',
      'any.required': 'Password is required'
    })
  }),
  
  clientLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    deviceId: Joi.string().required().messages({
      'any.required': 'Device ID is required for security'
    })
  }),
  
  register: Joi.object({
    fullName: Joi.string().min(2).max(100).required().messages({
      'string.min': 'Full name must be at least 2 characters',
      'any.required': 'Full name is required'
    }),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).required().messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain uppercase, lowercase, and number',
      'any.required': 'Password is required'
    })
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required().messages({
      'any.required': 'Refresh token is required'
    })
  }),
  
  // Client schemas
  createClient: Joi.object({
    fullName: Joi.string().min(2).max(100).required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    status: Joi.string().valid('active', 'disabled').default('active'),
    devicePolicyEnabled: Joi.boolean().default(true),
    notes: Joi.string().allow('', null).max(500)
  }),
  
  updateClient: Joi.object({
    fullName: Joi.string().min(2).max(100),
    email: Joi.string().email(),
    password: Joi.string().min(8),
    status: Joi.string().valid('active', 'disabled'),
    devicePolicyEnabled: Joi.boolean(),
    notes: Joi.string().allow('', null).max(500)
  }).min(1),
  
  // Tool schemas
  createTool: Joi.object({
    name: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(1000).allow('', null),
    targetUrl: Joi.string().uri().required().messages({
      'string.uri': 'Please provide a valid URL'
    }),
    category: Joi.string().valid(
      'AI', 'Academic', 'SEO', 'Productivity', 
      'Graphics & SEO', 'Text Humanizers', 
      'Career-Oriented', 'Miscellaneous', 'Other'
    ).default('Other'),
    status: Joi.string().valid('active', 'inactive').default('active'),
    cookiesEncrypted: Joi.string().allow('', null),
    fileMeta: Joi.object({
      name: Joi.string(),
      size: Joi.number(),
      type: Joi.string()
    }).allow(null)
  }),
  
  updateTool: Joi.object({
    name: Joi.string().min(2).max(200),
    description: Joi.string().max(1000).allow('', null),
    targetUrl: Joi.string().uri(),
    category: Joi.string().valid(
      'AI', 'Academic', 'SEO', 'Productivity', 
      'Graphics & SEO', 'Text Humanizers', 
      'Career-Oriented', 'Miscellaneous', 'Other'
    ),
    status: Joi.string().valid('active', 'inactive'),
    cookiesEncrypted: Joi.string().allow('', null),
    fileMeta: Joi.object({
      name: Joi.string(),
      size: Joi.number(),
      type: Joi.string()
    }).allow(null)
  }).min(1),
  
  // Assignment schemas
  createAssignment: Joi.object({
    clientId: Joi.string().required(),
    toolId: Joi.string().required(),
    startDate: Joi.date().iso().allow(null),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).allow(null).messages({
      'date.min': 'End date must be after start date'
    }),
    durationDays: Joi.number().min(1).max(3650).allow(null),
    notes: Joi.string().max(500).allow('', null)
  }),
  
  bulkAssign: Joi.object({
    clientIds: Joi.array().items(Joi.string()).min(1).required(),
    toolIds: Joi.array().items(Joi.string()).min(1).required(),
    startDate: Joi.date().iso().allow(null),
    durationDays: Joi.number().min(1).max(3650).allow(null),
    notes: Joi.string().max(500).allow('', null)
  }),
  
  // Device schemas
  requestCookies: Joi.object({
    deviceId: Joi.string().required().messages({
      'any.required': 'Device ID is required for security'
    })
  })
};

module.exports = {
  validate,
  schemas
};
