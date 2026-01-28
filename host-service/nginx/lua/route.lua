-- Lua routing script for NGINX
-- Reads port-registry.json and sets the backend port for each request

local cjson = require "cjson"

-- Cache for port registry (reduces file reads)
local cache = ngx.shared.port_cache
local CACHE_TTL = 5  -- seconds

-- Read and parse port registry
local function get_registry()
    local cached = cache:get("registry")
    if cached then
        return cjson.decode(cached)
    end

    -- Read from file
    local file = io.open("/app/registry/port-registry.json", "r")
    if not file then
        ngx.log(ngx.ERR, "Cannot open port-registry.json")
        return nil
    end

    local content = file:read("*all")
    file:close()

    -- Cache the content
    cache:set("registry", content, CACHE_TTL)

    return cjson.decode(content)
end

-- Get port for a specific project and path
local function get_port(project_id, path)
    local registry = get_registry()
    if not registry then
        return nil, "Registry not available"
    end

    local project = registry.projects[project_id]
    if not project then
        return nil, "Project not found: " .. project_id
    end

    if project.status ~= "running" then
        return nil, "Project not running: " .. project_id
    end

    -- Check for isolated endpoint
    if path and project.isolatedEndpoints then
        for endpoint_path, port in pairs(project.isolatedEndpoints) do
            -- Simple prefix match
            if path:sub(1, #endpoint_path) == endpoint_path then
                return port
            end
        end
    end

    -- Return base project port
    return project.port
end

-- Main execution
local project_id = ngx.var.project_id
local path = ngx.var.path_remainder or "/"

local port, err = get_port(project_id, path)

if not port then
    ngx.log(ngx.WARN, "Routing error: " .. (err or "unknown"))
    ngx.exit(ngx.HTTP_NOT_FOUND)
end

ngx.var.backend_port = port
