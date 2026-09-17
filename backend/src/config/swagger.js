const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'PERN ERP System API Documentation',
      version: '1.0.0',
      description: `
### Manufacturing and Supply Company ERP API
Workflow: Customer Enquiry → Quotation → Sales Order → Inventory Reservation → Dispatch

#### Authentication:
Bearer JWT token required for protected routes. Send header: \`Authorization: Bearer <token>\`

#### Roles:
- **ADMIN**: Full access (Confirm orders, process dispatch, adjust inventory, view all records)
- **SALES_USER**: Create enquiries, create quotations, accept/reject quotations, convert accepted quotations to sales orders, view inventory availability.
      `,
      contact: {
        name: 'Bhargav Reddy',
      },
    },
    servers: [
      {
        url: 'http://localhost:5000',
        description: 'Local Development Server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
