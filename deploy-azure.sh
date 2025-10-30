#!/bin/bash
# PowerNode Azure Deployment Script
# Resource Group: wippli-powernode-rg
# Location: australiaeast

set -e  # Exit on error

RESOURCE_GROUP="wippli-powernode-rg"
LOCATION="australiaeast"

echo "🚀 PowerNode Azure Deployment"
echo "=============================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo ""

# 1. Create Storage Account for Executions Table
echo "📦 [1/6] Creating Storage Account for execution logs..."
az storage account create \
  --name powernodeexecutions \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --kind StorageV2

# Get connection string
STORAGE_CONNECTION=$(az storage account show-connection-string \
  --name powernodeexecutions \
  --resource-group $RESOURCE_GROUP \
  --output tsv)

echo "✅ Storage Account created: powernodeexecutions"

# 2. Create Tables
echo "📊 [2/6] Creating tables..."
for table in powernodeexecutions powernodecreators; do
  az storage table create \
    --name $table \
    --account-name powernodeexecutions \
    --connection-string "$STORAGE_CONNECTION"
  echo "   ✓ Table created: $table"
done

# 3. Create Static Web App for Monitoring UI
echo "🌐 [3/6] Creating Static Web App for powernode.wippli.ai..."
az staticwebapp create \
  --name powernode-monitoring \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --source https://github.com/Wippli-Org/wippli-powernode \
  --branch main \
  --app-location "/monitoring-ui" \
  --output-location ".next" \
  --login-with-github

STATIC_APP_URL=$(az staticwebapp show \
  --name powernode-monitoring \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostname" -o tsv)

echo "✅ Static Web App created: https://$STATIC_APP_URL"
echo "   Next: Configure custom domain powernode.wippli.ai"

# 4. Create Azure Functions (PowerNode Backend)
echo "⚡ [4/6] Creating Azure Functions..."
az functionapp create \
  --name powernode-functions \
  --resource-group $RESOURCE_GROUP \
  --storage-account powernodeexecutions \
  --consumption-plan-location $LOCATION \
  --runtime node \
  --runtime-version 18 \
  --functions-version 4 \
  --os-type Linux

FUNCTIONS_URL=$(az functionapp show \
  --name powernode-functions \
  --resource-group $RESOURCE_GROUP \
  --query "defaultHostName" -o tsv)

echo "✅ Azure Functions created: https://$FUNCTIONS_URL"

# 5. Set Function App Settings
echo "⚙️  [5/6] Configuring Function App settings..."
az functionapp config appsettings set \
  --name powernode-functions \
  --resource-group $RESOURCE_GROUP \
  --settings \
    POWERNODE_STORAGE_CONNECTION="$STORAGE_CONNECTION" \
    ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
    WIPPLI_API_KEY="$WIPPLI_API_KEY" \
    NODE_ENV=production

echo "✅ Function App settings configured"

# 6. Create Container App Environment for MCP Server
echo "🐳 [6/6] Creating Container App Environment for MCP Server..."
az containerapp env create \
  --name powernode-env \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION

echo "✅ Container App Environment created: powernode-env"
echo "   Note: MCP Server container app will be deployed after Docker image is built"

echo ""
echo "=============================="
echo "✅ Infrastructure Deployment Complete!"
echo "=============================="
echo ""
echo "📝 Summary:"
echo "───────────"
echo ""
echo "Resource Group:     $RESOURCE_GROUP"
echo "Location:           $LOCATION"
echo ""
echo "Resources Created:"
echo "  1. Storage Account:   powernodeexecutions"
echo "     - Tables: powernodeexecutions, powernodecreators"
echo ""
echo "  2. Static Web App:    powernode-monitoring"
echo "     - URL: https://$STATIC_APP_URL"
echo "     - Custom Domain: powernode.wippli.ai (configure manually)"
echo ""
echo "  3. Azure Functions:   powernode-functions"
echo "     - URL: https://$FUNCTIONS_URL"
echo "     - Runtime: Node.js 18"
echo ""
echo "  4. Container Env:     powernode-env"
echo "     - Ready for MCP Server deployment"
echo ""
echo "🔐 Environment Variables Set:"
echo "  - POWERNODE_STORAGE_CONNECTION"
echo "  - ANTHROPIC_API_KEY (from env)"
echo "  - WIPPLI_API_KEY (from env)"
echo ""
echo "📋 Next Steps:"
echo "  1. Configure custom domain: az staticwebapp hostname set ..."
echo "  2. Deploy monitoring UI: cd monitoring-ui && npm run build"
echo "  3. Deploy functions: cd azure-functions && func azure functionapp publish powernode-functions"
echo "  4. Build & deploy MCP server container"
echo "  5. Provision first creator (proLogistik)"
echo ""
echo "🔗 Useful Commands:"
echo "  View resources: az resource list --resource-group $RESOURCE_GROUP --output table"
echo "  View logs: az staticwebapp show --name powernode-monitoring"
echo "  Delete all: az group delete --name $RESOURCE_GROUP --yes"
echo ""
