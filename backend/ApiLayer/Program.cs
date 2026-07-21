using AtmDashboard.BusinessLayer.Services;
using AtmDashboard.DataLayer.Context;
using AtmDashboard.DataLayer.Repositories;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using System.Text.Json.Serialization;

var builder = WebApplication.CreateBuilder(args);

// JSON: snake_case to match the React frontend's TypeScript interfaces
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower;
        options.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Data source: SQL Server by default; in-memory demo data when "UseDemoData": true
// (lets the frontend + comparison feature run on a machine without SQL Server)
if (builder.Configuration.GetValue<bool>("UseDemoData"))
{
    builder.Services.AddSingleton<IAtmRepository, DemoAtmRepository>();
}
else
{
    builder.Services.AddDbContext<AtmDbContext>(options =>
        options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));
    builder.Services.AddScoped<IAtmRepository, AtmRepository>();
}

builder.Services.AddScoped<IAtmService, AtmService>();

// CORS — origins come from config (see "AllowedOrigins" in appsettings.json)
// so a new machine/port only needs a config edit, not a rebuild.
var allowedOrigins = builder.Configuration.GetSection("AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://localhost:5174", "http://localhost:3000" };

builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy
            .WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

// Skip HTTPS redirect in dev so the frontend can call plain http://localhost:5143
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
app.UseCors("FrontendPolicy");
app.UseAuthorization();
app.MapControllers();

app.Run();
