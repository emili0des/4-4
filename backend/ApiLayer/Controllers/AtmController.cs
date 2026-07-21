using AtmDashboard.BusinessLayer.Services;
using Microsoft.AspNetCore.Mvc;

namespace AtmDashboard.ApiLayer.Controllers;

[ApiController]
[Route("api/atm")]
public class AtmController : ControllerBase
{
    private readonly IAtmService _service;

    public AtmController(IAtmService service)
    {
        _service = service;
    }

    [HttpGet("balances")]
    public async Task<IActionResult> GetBalances()
    {
        var result = await _service.GetLatestBalancesAsync();
        return Ok(result);
    }

    [HttpGet("statuses")]
    public async Task<IActionResult> GetStatuses()
    {
        var result = await _service.GetLatestStatusesAsync();
        return Ok(result);
    }

    /// <summary>
    /// Compares the latest report file against the previous one:
    /// which hardware errors were fixed / appeared / persist, and which
    /// ATMs were refilled, recovered, or went critical.
    /// Thresholds are % of cash remaining and must satisfy 0 &lt; critical &lt; low &lt; 100.
    /// </summary>
    [HttpGet("comparison")]
    public async Task<IActionResult> GetComparison(
        [FromQuery] double criticalThreshold = 20,
        [FromQuery] double lowThreshold = 50)
    {
        // IsFinite guards NaN/Infinity, which would pass the comparisons below silently
        if (!double.IsFinite(criticalThreshold) || !double.IsFinite(lowThreshold) ||
            criticalThreshold <= 0 || lowThreshold <= criticalThreshold || lowThreshold >= 100)
            return BadRequest("Thresholds must satisfy 0 < criticalThreshold < lowThreshold < 100.");

        var result = await _service.GetComparisonAsync(criticalThreshold, lowThreshold);
        return Ok(result);
    }
}
