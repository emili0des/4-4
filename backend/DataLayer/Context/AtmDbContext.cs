using AtmDashboard.DomainModel.Entities;
using Microsoft.EntityFrameworkCore;

namespace AtmDashboard.DataLayer.Context;

public class AtmDbContext : DbContext
{
    public AtmDbContext(DbContextOptions<AtmDbContext> options) : base(options) { }

    public DbSet<AtmBalanceFile> AtmBalanceFiles { get; set; }
    public DbSet<AtmStatusFile> AtmStatusFiles { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AtmBalanceFile>().ToTable("AtmBalanceFile");
        modelBuilder.Entity<AtmStatusFile>().ToTable("AtmStatusFile");
        base.OnModelCreating(modelBuilder);
    }
}
